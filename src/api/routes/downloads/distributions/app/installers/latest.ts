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
import { ApiError, ClientRelease, FieldErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

export const DISTRIBUTED_INSTALLER_CHANNELS = ["stable", "ptb", "canary", "development"] as const;
export const DISTRIBUTED_INSTALLER_PLATFORMS = ["win"] as const;
export const DISTRIBUTED_INSTALLER_ARCHITECTURES = ["x86", "x64", "arm64"] as const;
export const DISTRIBUTED_INSTALLER_NOT_FOUND = new ApiError("404: Not Found", 0, 404);

type DistributedInstallerChannel = (typeof DISTRIBUTED_INSTALLER_CHANNELS)[number];
type DistributedInstallerPlatform = (typeof DISTRIBUTED_INSTALLER_PLATFORMS)[number];
type DistributedInstallerArchitecture = (typeof DISTRIBUTED_INSTALLER_ARCHITECTURES)[number];

export interface DistributedInstallerQuery {
    channel: DistributedInstallerChannel;
    platform: DistributedInstallerPlatform;
    arch: DistributedInstallerArchitecture;
}

router.get(
    "/",
    route({
        summary: "Get Latest Distributed Application Installer",
        description: "Redirects to the latest Windows application installer for the selected release channel, platform, and architecture.",
        query: {
            channel: {
                type: "string",
                required: true,
                description: "Desktop release channel to get the installer for.",
                values: [...DISTRIBUTED_INSTALLER_CHANNELS],
            },
            platform: {
                type: "string",
                required: true,
                description: "Desktop platform to get the installer for. Distributed installers are currently Windows-only.",
                values: [...DISTRIBUTED_INSTALLER_PLATFORMS],
            },
            arch: {
                type: "string",
                required: true,
                description: "Desktop architecture to get the installer for.",
                values: [...DISTRIBUTED_INSTALLER_ARCHITECTURES],
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
        const { channel, platform, arch } = parseDistributedInstallerQuery(req);
        const release = await findLatestDistributedInstallerRelease(channel, platform, arch);

        if (!release) throw DISTRIBUTED_INSTALLER_NOT_FOUND;

        res.redirect(release.url);
    },
);

export async function findLatestDistributedInstallerRelease(
    releaseChannel: DistributedInstallerChannel,
    platform: DistributedInstallerPlatform,
    arch: DistributedInstallerArchitecture,
): Promise<ClientRelease | null> {
    return ClientRelease.findOne({
        where: {
            enabled: true,
            release_channel: releaseChannel,
            platform,
            arch,
        },
        order: { pub_date: "DESC" },
    });
}

export function parseDistributedInstallerQuery(req: Request): DistributedInstallerQuery {
    const errors: Record<string, { code?: string; message: string }> = {};
    const channel = stringQueryParam(req.query.channel);
    const platform = stringQueryParam(req.query.platform);
    const arch = stringQueryParam(req.query.arch);

    addRequiredChoiceError(req, errors, "channel", channel, DISTRIBUTED_INSTALLER_CHANNELS);
    addRequiredChoiceError(req, errors, "platform", platform, DISTRIBUTED_INSTALLER_PLATFORMS);
    addRequiredChoiceError(req, errors, "arch", arch, DISTRIBUTED_INSTALLER_ARCHITECTURES);

    if (Object.keys(errors).length) throw FieldErrors(errors);

    return {
        channel: channel as DistributedInstallerChannel,
        platform: platform as DistributedInstallerPlatform,
        arch: arch as DistributedInstallerArchitecture,
    };
}

function requestTranslation(req: Request, key: string): string {
    return typeof req.t === "function" ? req.t(key) : key;
}

function stringQueryParam(value: Request["query"][string]): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function addRequiredChoiceError(
    req: Request,
    errors: Record<string, { code?: string; message: string }>,
    key: string,
    value: string | undefined,
    choices: readonly string[],
): void {
    if (!value) {
        errors[key] = {
            code: "BASE_TYPE_REQUIRED",
            message: requestTranslation(req, "common:field.BASE_TYPE_REQUIRED"),
        };
        return;
    }

    if (!choices.includes(value)) {
        errors[key] = {
            code: "BASE_TYPE_CHOICES",
            message: `Value must be one of (${choices.map((choice) => `'${choice}'`).join(", ")}).`,
        };
    }
}

export default router;
