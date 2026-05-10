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
import { ApiError, FieldErrors, ClientRelease } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

const DESKTOP_RELEASE_CHANNELS = new Set(["stable", "ptb", "canary", "development"]);
const MOBILE_RELEASE_CHANNEL = "mobile";
export const MOBILE_DOWNLOAD_URL = "https://discord.com/download";
export const DOWNLOAD_NOT_FOUND = new ApiError("404: Not Found", 0, 404);

function requestTranslation(req: Request, key: string): string {
    return typeof req.t === "function" ? req.t(key) : key;
}

function stringQueryParam(value: Request["query"][string]): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function requireDownloadPlatform(req: Request): string {
    const platform = stringQueryParam(req.query.platform);

    if (platform) return platform;

    throw FieldErrors({
        platform: {
            code: "BASE_TYPE_REQUIRED",
            message: requestTranslation(req, "common:field.BASE_TYPE_REQUIRED"),
        },
    });
}

export function isSupportedDownloadReleaseChannel(releaseChannel: string | undefined): boolean {
    return !!releaseChannel && (releaseChannel === MOBILE_RELEASE_CHANNEL || DESKTOP_RELEASE_CHANNELS.has(releaseChannel));
}

export async function findLatestClientRelease(platform: string): Promise<ClientRelease | null> {
    return ClientRelease.findOne({
        where: {
            enabled: true,
            platform,
        },
        order: { pub_date: "DESC" },
    });
}

async function redirectLatestClientRelease(req: Request, res: Response) {
    const platform = requireDownloadPlatform(req);
    const release = await findLatestClientRelease(platform);

    if (!release) throw DOWNLOAD_NOT_FOUND;

    res.redirect(release.url);
}

router.get(
    "/",
    route({
        summary: "Get Latest Application Installer",
        description: "Redirects to the latest available desktop client installer for the selected platform.",
        query: {
            platform: {
                type: "string",
                required: true,
                description: "Desktop platform to get the installer for.",
                values: ["win", "osx", "linux"],
            },
            format: {
                type: "string",
                description: "Linux executable format to get the installer for. Defaults to deb.",
                values: ["deb", "tar.gz"],
            },
        },
        responses: {
            302: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        await redirectLatestClientRelease(req, res);
    },
);

router.get(
    "/:release_channel",
    route({
        summary: "Get Latest Application Installer",
        description:
            "Redirects to the latest available desktop client installer for the provided release channel and selected platform. The special mobile channel redirects to the download page.",
        query: {
            platform: {
                type: "string",
                required: true,
                description: "Desktop platform to get the installer for.",
                values: ["win", "osx", "linux"],
            },
            format: {
                type: "string",
                description: "Linux executable format to get the installer for. Defaults to deb.",
                values: ["deb", "tar.gz"],
            },
        },
        responses: {
            302: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { release_channel } = req.params as { release_channel?: string };

        if (!isSupportedDownloadReleaseChannel(release_channel)) throw DOWNLOAD_NOT_FOUND;
        if (release_channel === MOBILE_RELEASE_CHANNEL) {
            res.redirect(MOBILE_DOWNLOAD_URL);
            return;
        }

        await redirectLatestClientRelease(req, res);
    },
);

export default router;
