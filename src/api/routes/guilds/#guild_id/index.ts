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

import { route } from "@spacebar/api";
import {
    Channel,
    DiscordApiErrors,
    Guild,
    GuildUpdateEvent,
    Member,
    Permissions,
    SpacebarApiErrors,
    emitEvent,
    getPermission,
    getRights,
    deleteFile,
    handleFile,
    Config,
    removeChannelOrderingFromGuildSave,
    MUTABLE_GUILD_FEATURES,
    type GuildFeatureValue,
} from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { GuildUpdateSchema } from "@spacebar/schemas";

const router = Router({ mergeParams: true });

type GuildImageFieldMutation = {
    uploadFile: typeof handleFile;
};

type GuildImageFieldOptions = {
    mutation?: GuildImageFieldMutation;
    replacedImagePaths?: string[];
};

type GuildUpdateImageCleanupOptions = {
    saveGuild: () => Promise<unknown>;
    emitGuildUpdate: () => Promise<unknown>;
    replacedImagePaths: string[];
    deleteReplacedImages?: (paths: string[]) => Promise<unknown>;
};

const defaultGuildImageFieldMutation: GuildImageFieldMutation = {
    uploadFile: handleFile,
};

export async function handleGuildImageField(
    path: string,
    value?: string | null,
    current?: string | null,
    options: GuildImageFieldOptions = {},
): Promise<string | null | undefined> {
    if (value === undefined || value === current) return value;

    let next = value;
    if (value) {
        if (!value.startsWith("data:")) throw new HTTPError("Invalid " + path);
        next = (await (options.mutation ?? defaultGuildImageFieldMutation).uploadFile(path, value)) ?? null;
    }

    if (current && next !== current) options.replacedImagePaths?.push(`${path}/${current}`);

    return next;
}

export async function deleteReplacedGuildImages(paths: string[], removeFile: typeof deleteFile = deleteFile) {
    const results = await Promise.allSettled(paths.map((path) => removeFile(path)));

    results.forEach((result, index) => {
        if (result.status === "rejected") console.error(`Failed to delete replaced guild image ${paths[index]}`, result.reason);
    });
}

export async function saveGuildUpdateAndDeleteReplacedImages({
    saveGuild,
    emitGuildUpdate,
    replacedImagePaths,
    deleteReplacedImages = deleteReplacedGuildImages,
}: GuildUpdateImageCleanupOptions) {
    await saveGuild();
    await deleteReplacedImages(replacedImagePaths);
    await emitGuildUpdate();
}

router.get(
    "/",
    route({
        responses: {
            "200": {
                body: "APIGuildWithJoinedAt",
            },
            401: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id } = req.params as { [key: string]: string };

        const [guild, member] = await Promise.all([Guild.findOneOrFail({ where: { id: guild_id } }), Member.findOne({ where: { guild_id: guild_id, id: req.user_id } })]);
        if (!member) throw new HTTPError("You are not a member of the guild you are trying to access", 401);

        return res.send({
            ...guild,
            joined_at: member?.joined_at,
        });
    },
);

router.patch(
    "/",
    route({
        requestBody: "GuildUpdateSchema",
        permission: "MANAGE_GUILD",
        responses: {
            200: {
                body: "GuildCreateResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const body = req.body as GuildUpdateSchema;
        const { guild_id } = req.params as { [key: string]: string };

        const rights = await getRights(req.user_id);
        const permission = await getPermission(req.user_id, guild_id);

        if (!rights.has("MANAGE_GUILDS") && !permission.has("MANAGE_GUILD")) throw DiscordApiErrors.MISSING_PERMISSIONS.withParams("MANAGE_GUILDS");

        const guild = await Guild.findOneOrFail({
            where: { id: guild_id },
            relations: { emojis: true, roles: true, stickers: true },
        });

        // trying to `select` this fails
        guild.channel_ordering = (
            await Guild.findOneOrFail({
                where: { id: guild_id },
                select: { channel_ordering: true },
            })
        ).channel_ordering;

        const replacedGuildImagePaths: string[] = [];
        const imageFieldOptions = { replacedImagePaths: replacedGuildImagePaths };

        if ("icon" in body) body.icon = await handleGuildImageField(`/icons/${guild_id}`, body.icon, guild.icon);
        if ("banner" in body) body.banner = await handleGuildImageField(`/banners/${guild_id}`, body.banner, guild.banner, imageFieldOptions);
        if ("splash" in body) body.splash = await handleGuildImageField(`/splashes/${guild_id}`, body.splash, guild.splash);
        if ("discovery_splash" in body)
            body.discovery_splash = (await handleGuildImageField(`/discovery-splashes/${guild_id}`, body.discovery_splash, guild.discovery_splash)) as string | undefined;

        if (body.features) {
            const requestedFeatures = body.features as GuildFeatureValue[];
            const diff = guild.features.filter((x) => !requestedFeatures.includes(x)).concat(requestedFeatures.filter((x) => !guild.features.includes(x)));

            for (const feature of diff) {
                if (MUTABLE_GUILD_FEATURES.includes(feature)) continue;

                throw SpacebarApiErrors.FEATURE_IS_IMMUTABLE.withParams(feature);
            }

            // for some reason, they don't update in the assign.
            guild.features = requestedFeatures;
        }

        // TODO: check if body ids are valid
        guild.assign(body);

        if (body.public_updates_channel_id == "1") {
            // create an updates channel for them
            const channel = await Channel.createChannel(
                {
                    name: "moderator-only",
                    guild_id: guild.id,
                    position: 0,
                    type: 0,
                    permission_overwrites: [
                        // remove SEND_MESSAGES from @everyone
                        {
                            id: guild.id,
                            allow: "0",
                            deny: Permissions.FLAGS.VIEW_CHANNEL.toString(),
                            type: 0,
                        },
                    ],
                },
                undefined,
                { skipPermissionCheck: true },
            );

            guild.public_updates_channel_id = channel.id;
        } else if (body.public_updates_channel_id != undefined) {
            // ensure channel exists in this guild
            await Channel.findOneOrFail({
                where: { guild_id, id: body.public_updates_channel_id },
                select: { id: true },
            });
        }

        if (body.safety_alerts_channel_id != undefined) {
            // ensure channel exists in this guild when set; null clears it
            if (body.safety_alerts_channel_id !== null) {
                await Channel.findOneOrFail({
                    where: { guild_id, id: body.safety_alerts_channel_id },
                    select: { id: true },
                });
            }
        }

        if (body.rules_channel_id == "1") {
            // create a rules for them
            const channel = await Channel.createChannel(
                {
                    name: "rules",
                    guild_id: guild.id,
                    position: 0,
                    type: 0,
                    permission_overwrites: [
                        // remove SEND_MESSAGES from @everyone
                        {
                            id: guild.id,
                            allow: "0",
                            deny: Permissions.FLAGS.SEND_MESSAGES.toString(),
                            type: 0,
                        },
                    ],
                },
                undefined,
                { skipPermissionCheck: true },
            );

            guild.rules_channel_id = channel.id;
        } else if (body.rules_channel_id != undefined) {
            // ensure channel exists in this guild
            await Channel.findOneOrFail({
                where: { guild_id, id: body.rules_channel_id },
                select: { id: true },
            });
        }

        // Channel.createChannel owns guild.channel_ordering writes. Do not let this
        // route's guild save overwrite ordering with a stale select:false value.
        removeChannelOrderingFromGuildSave(guild);

        const data = guild.toGuildUpdateEventData();

        await saveGuildUpdateAndDeleteReplacedImages({
            saveGuild: () => guild.save(),
            replacedImagePaths: replacedGuildImagePaths,
            emitGuildUpdate: () =>
                emitEvent({
                    event: "GUILD_UPDATE",
                    data,
                    guild_id,
                } satisfies GuildUpdateEvent),
        });

        return res.json(data);
    },
);

export default router;
