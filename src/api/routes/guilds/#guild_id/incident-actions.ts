/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

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
import { AutomodIncidentActionsResponse, AutomodIncidentActionsSchema } from "@spacebar/schemas";
import { Guild, type GuildUpdateEvent, emitEvent } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const router = Router({ mergeParams: true });

const maxIncidentActionFutureMs = 24 * 60 * 60 * 1000;

type IncidentActionField = keyof AutomodIncidentActionsSchema;
type StoredIncidentActions = {
    raid_detected_at?: string | Date | null;
    dm_spam_detected_at?: string | Date | null;
    invites_disabled_until?: string | Date | null;
    dms_disabled_until?: string | Date | null;
};

function serializeStoredTimestamp(value: string | Date | null | undefined): string | null {
    if (value == null) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeIncidentActionTimestamp(field: IncidentActionField, value: Date | string | null | undefined, now = Date.now()): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new HTTPError(`${field} must be an ISO8601 timestamp`, 400);

    if (date.getTime() - now > maxIncidentActionFutureMs) {
        const label = field === "dms_disabled_until" ? "DMs disabled until time" : "Invites disabled until time";
        throw new HTTPError(`${label} cannot exceed 24 hours into the future`, 400);
    }

    return date.toISOString();
}

function buildIncidentActionsResponse(incidentsData: StoredIncidentActions): AutomodIncidentActionsResponse {
    return {
        invites_disabled_until: serializeStoredTimestamp(incidentsData.invites_disabled_until) as Date | null,
        dms_disabled_until: serializeStoredTimestamp(incidentsData.dms_disabled_until) as Date | null,
    };
}

router.put(
    "/",
    route({
        requestBody: "AutomodIncidentActionsSchema",
        permission: "MANAGE_GUILD",
        responses: {
            200: {
                body: "AutomodIncidentActionsResponse",
            },
            400: {
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
        const { guild_id } = req.params as { [key: string]: string };
        const body = req.body as AutomodIncidentActionsSchema;

        const guild = await Guild.findOneOrFail({
            where: { id: guild_id },
            relations: { emojis: true, roles: true, stickers: true },
        });

        const incidentsData: StoredIncidentActions = { ...(guild.incidents_data ?? {}) };
        const invitesDisabledUntil = normalizeIncidentActionTimestamp("invites_disabled_until", body.invites_disabled_until as Date | string | null | undefined);
        const dmsDisabledUntil = normalizeIncidentActionTimestamp("dms_disabled_until", body.dms_disabled_until as Date | string | null | undefined);

        if (invitesDisabledUntil !== undefined) incidentsData.invites_disabled_until = invitesDisabledUntil;
        if (dmsDisabledUntil !== undefined) incidentsData.dms_disabled_until = dmsDisabledUntil;

        guild.incidents_data = incidentsData as Guild["incidents_data"];
        await guild.save();

        await emitEvent({
            event: "GUILD_UPDATE",
            data: guild.toGuildUpdateEventData(),
            guild_id,
        } satisfies GuildUpdateEvent);

        return res.json(buildIncidentActionsResponse(incidentsData));
    },
);

export default router;
