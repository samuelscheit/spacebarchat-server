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
import { type UpdatesResponse } from "@spacebar/schemas";
import { ApiError, FieldErrors, ClientRelease } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });
const DESKTOP_RELEASE_CHANNELS = new Set(["stable", "ptb", "canary", "development"]);
const DEFAULT_UPDATE_PLATFORM = "osx";

export const UPDATE_NOT_FOUND = new ApiError("404: Not Found", 0, 404);

type FindLatestClientUpdateOptions = {
    platform: string;
    releaseChannel?: string;
};

function requestTranslation(req: Request, key: string): string {
    return typeof req.t === "function" ? req.t(key) : key;
}

function firstStringQueryParam(value: Request["query"][string]): string | undefined {
    if (typeof value === "string") return value.length > 0 ? value : undefined;
    if (Array.isArray(value)) {
        const first = value.find((entry): entry is string => typeof entry === "string" && entry.length > 0);
        return first;
    }
    return undefined;
}

export function requireUpdatePlatform(req: Request): string {
    const platform = firstStringQueryParam(req.query.platform);

    if (platform) return platform;

    throw FieldErrors({
        platform: {
            code: "BASE_TYPE_REQUIRED",
            message: requestTranslation(req, "common:field.BASE_TYPE_REQUIRED"),
        },
    });
}

export function optionalUpdatePlatform(req: Request): string {
    return firstStringQueryParam(req.query.platform) ?? DEFAULT_UPDATE_PLATFORM;
}

export function isSupportedUpdateReleaseChannel(releaseChannel: string | undefined): boolean {
    return !!releaseChannel && DESKTOP_RELEASE_CHANNELS.has(releaseChannel);
}

export async function findLatestClientUpdate(options: FindLatestClientUpdateOptions): Promise<ClientRelease | null> {
    return ClientRelease.findOne({
        where: {
            enabled: true,
            platform: options.platform,
            ...(options.releaseChannel ? { release_channel: options.releaseChannel } : {}),
        },
        order: { pub_date: "DESC" },
    });
}

export function serializeUpdateResponse(release: ClientRelease): UpdatesResponse {
    return {
        name: release.name,
        pub_date: release.pub_date.toISOString(),
        url: release.url,
        notes: release.notes ?? null,
    };
}

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "UpdatesResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const release = await ClientRelease.findOneOrFail({
            where: {
                enabled: true,
                platform: requireUpdatePlatform(req),
            },
            order: { pub_date: "DESC" },
        });

        res.json(serializeUpdateResponse(release));
    },
);

router.get(
    "/:release_channel",
    route({
        summary: "Get Application Updates",
        description:
            "Returns locally configured application host update information for the provided release channel and selected platform. Spacebar only returns data backed by ClientRelease rows.",
        query: {
            platform: {
                type: "string",
                description: "Desktop platform to get update information for. Defaults to osx.",
                values: ["win", "osx", "linux"],
            },
        },
        responses: {
            200: {
                body: "UpdatesResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { release_channel } = req.params as { release_channel?: string };

        if (!isSupportedUpdateReleaseChannel(release_channel)) throw UPDATE_NOT_FOUND;

        const release = await findLatestClientUpdate({
            platform: optionalUpdatePlatform(req),
            releaseChannel: release_channel,
        });

        if (!release) throw UPDATE_NOT_FOUND;

        res.json(serializeUpdateResponse(release));
    },
);

export default router;
