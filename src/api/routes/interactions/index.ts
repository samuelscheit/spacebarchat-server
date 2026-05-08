/*
  Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
  Copyright (C) 2023 Spacebar and Spacebar Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published
  by the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { randomBytes } from "node:crypto";
import { DataInteractionRequest, InteractionFailureReason, InteractionSchema, InteractionType } from "@spacebar/schemas";
import { route } from "@spacebar/api";
import { Request, Response, Router } from "express";
import {
    Config,
    emitEvent,
    getPermission,
    Guild,
    InteractionCreateEvent,
    InteractionFailureEvent,
    Member,
    Message,
    Snowflake,
    messagePublicWithThreadRelations,
} from "@spacebar/util";
import { pendingInteractions } from "@spacebar/util/imports/Interactions";
import { getAuthorizingIntegrationOwners } from "@spacebar/schemas/api/bots/InteractionCreateSchema";
import { buildBotInteractionCreatePayload, RoutedInteractionCreatePayload } from "../../util/handlers/InteractionCreateRouting";

const router = Router({ mergeParams: true });

function hasInteractionData(body: InteractionSchema): body is DataInteractionRequest {
    return body.type !== InteractionType.Ping;
}

router.post("/", route({ requestBody: "InteractionSchema" }), async (req: Request, res: Response) => {
    const body = req.body as InteractionSchema;

    const interactionId = Snowflake.generate();
    const interactionToken = randomBytes(24).toString("base64url");

    await emitEvent({
        event: "INTERACTION_CREATE",
        user_id: req.user_id,
        data: {
            id: interactionId,
            nonce: body.nonce,
        },
    } satisfies InteractionCreateEvent);

    const user = req.user;

    const interactionData: RoutedInteractionCreatePayload = {
        id: interactionId,
        application_id: body.application_id,
        channel_id: body.channel_id,
        type: body.type,
        token: interactionToken,
        version: 1,
        entitlements: [],
        authorizing_integration_owners: getAuthorizingIntegrationOwners({
            application_id: body.application_id,
            channel_id: body.channel_id,
            guild_id: body.guild_id,
            user_id: req.user_id,
        }),
        attachment_size_limit: Config.get().cdn.maxAttachmentSize,
    };

    if (hasInteractionData(body)) {
        interactionData.data = body.data;
    }

    if (body.type != InteractionType.Ping) {
        interactionData.locale = user?.settings?.locale;
    }

    if (body.guild_id) {
        interactionData.context = 0;
        interactionData.guild_id = body.guild_id;
        interactionData.app_permissions = (await getPermission(body.application_id, body.guild_id, body.channel_id)).bitfield.toString();

        const guild = await Guild.findOneOrFail({ where: { id: body.guild_id } });
        const member = await Member.findOneOrFail({ where: { guild_id: body.guild_id, id: req.user_id }, relations: { user: true, roles: true } });

        interactionData.guild = {
            id: guild.id,
            features: guild.features,
            locale: guild.preferred_locale!,
        };

        interactionData.guild_locale = guild.preferred_locale;
        interactionData.member = member.toPublicMember();
    } else {
        interactionData.user = user.toPublicUser();
        interactionData.app_permissions = (await getPermission(body.application_id, "", body.channel_id)).bitfield.toString();

        if (body.channel_id === body.application_id) {
            interactionData.context = 1;
        } else {
            interactionData.context = 2;
        }
    }

    if ((body.type === InteractionType.MessageComponent || body.type === InteractionType.ModalSubmit) && body.message_id) {
        interactionData.message = (
            await Message.findOneOrFail({
                where: { id: body.message_id, flags: undefined },
                relations: messagePublicWithThreadRelations,
            })
        ).toJSON();
    }

    await emitEvent({
        event: "INTERACTION_CREATE",
        user_id: body.application_id,
        data: buildBotInteractionCreatePayload(interactionData, {
            interactionId,
            memberId: req.user_id,
        }),
    } satisfies InteractionCreateEvent);

    const interactionTimeout = setTimeout(() => {
        emitEvent({
            event: "INTERACTION_FAILURE",
            user_id: req.user_id,
            data: {
                id: interactionId,
                nonce: body.nonce,
                reason_code: InteractionFailureReason.TIMEOUT,
            },
        } satisfies InteractionFailureEvent);
    }, 3000);

    pendingInteractions.set(interactionId, {
        timeout: interactionTimeout,
        nonce: body.nonce,
        applicationId: body.application_id,
        userId: req.user_id,
        guildId: body.guild_id,
        channelId: body.channel_id,
        type: body.type,
        commandType: hasInteractionData(body) && "type" in body.data ? body.data.type : undefined,
        commandName: hasInteractionData(body) && "name" in body.data ? body.data.name : undefined,
        messageId: body.message_id,
    });

    res.sendStatus(204);
});

export default router;
