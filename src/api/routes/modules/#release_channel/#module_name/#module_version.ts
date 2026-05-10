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
import { type APIErrorResponse } from "@spacebar/schemas";
import { type Request, type Response, Router } from "express";

const router = Router({ mergeParams: true });

const DEFAULT_PLATFORM = "osx";
const DEFAULT_HOST_VERSION = "0";
const NATIVE_MODULE_NAME = /^[A-Za-z0-9_-]+$/;
const NATIVE_MODULE_VERSION = /^(?:0|[1-9]\d*)$/;
const NATIVE_MODULE_NOT_FOUND: APIErrorResponse = {
    code: 404,
    message: "Native module not found",
};

export interface NativeModuleLookup {
    releaseChannel: string;
    moduleName: string;
    moduleVersion: string;
    platform: string;
    hostVersion: string;
}

function stringQueryParam(value: Request["query"][string], fallback: string): string {
    return typeof value === "string" ? value : fallback;
}

export function nativeModuleLookupFromRequest(req: Request): NativeModuleLookup | undefined {
    const { release_channel, module_name, module_version } = req.params as {
        release_channel?: string;
        module_name?: string;
        module_version?: string;
    };

    if (!release_channel || !module_name || !module_version) return undefined;
    if (!NATIVE_MODULE_NAME.test(module_name) || !NATIVE_MODULE_VERSION.test(module_version)) return undefined;

    return {
        releaseChannel: release_channel,
        moduleName: module_name,
        moduleVersion: module_version,
        platform: stringQueryParam(req.query.platform, DEFAULT_PLATFORM),
        hostVersion: stringQueryParam(req.query.host_version, DEFAULT_HOST_VERSION),
    };
}

export function getNativeModuleArchiveUrl(_lookup: NativeModuleLookup): string | undefined {
    return undefined;
}

router.get(
    "/",
    route({
        summary: "Get Native Module",
        description: "Redirects to a native module ZIP archive when the server has one available.",
        query: {
            platform: {
                type: "string",
                description: "Desktop platform to get the native module for. Defaults to osx.",
                values: ["win", "osx", "linux"],
            },
            host_version: {
                type: "string",
                description: "Host version to get the native module for. Defaults to 0.",
            },
        },
        responses: {
            302: {},
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => {
        const lookup = nativeModuleLookupFromRequest(req);
        const archiveUrl = lookup ? getNativeModuleArchiveUrl(lookup) : undefined;

        if (!archiveUrl) {
            res.status(404).json(NATIVE_MODULE_NOT_FOUND);
            return;
        }

        res.redirect(archiveUrl);
    },
);

export default router;
