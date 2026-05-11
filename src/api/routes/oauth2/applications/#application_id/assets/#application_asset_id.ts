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
import { ApiError, DiscordApiErrors, deleteFile } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import { requireApplicationAssetManagement, type ApplicationCommandAuthorizationRepository } from "../../../../../util/utility/ApplicationAuthorization";

const routeSnowflakePattern = /^[1-9]\d{16,19}$/;
const applicationAssetIdPattern = /^[A-Za-z0-9_-]{1,128}$/;

export const UNKNOWN_APPLICATION_ASSET = new ApiError("Unknown Application Asset", 10046, 404);

export type ApplicationAssetDeleteDependencies = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    deleteAssetFile?: (path: string) => Promise<unknown>;
};

export function isApplicationAssetRouteSnowflake(value: string) {
    return routeSnowflakePattern.test(value);
}

export function normalizeApplicationAssetRouteId(value: string) {
    return value.split(".")[0];
}

export function isApplicationAssetRouteId(value: string) {
    return applicationAssetIdPattern.test(normalizeApplicationAssetRouteId(value));
}

export function getApplicationAssetStoragePath(applicationId: string, applicationAssetId: string) {
    return `/app-assets/${applicationId}/${normalizeApplicationAssetRouteId(applicationAssetId)}`;
}

function isMissingApplicationAssetStorageError(error: unknown) {
    if (!error || typeof error !== "object") return false;

    const errorRecord = error as { code?: unknown; httpStatus?: unknown; name?: unknown; status?: unknown };

    if (String(errorRecord.code) === "ENOENT") return true;
    if (["NoSuchKey", "NotFound"].includes(String(errorRecord.name))) return true;
    if (errorRecord.httpStatus === 404 || errorRecord.status === 404) return true;

    return false;
}

export async function deleteApplicationAsset(
    applicationId: string,
    applicationAssetId: string,
    userId: string,
    dependencies: ApplicationAssetDeleteDependencies = {},
) {
    if (!isApplicationAssetRouteSnowflake(applicationId)) throw DiscordApiErrors.UNKNOWN_APPLICATION;
    if (!isApplicationAssetRouteId(applicationAssetId)) throw UNKNOWN_APPLICATION_ASSET;

    await requireApplicationAssetManagement(applicationId, userId, dependencies.applicationRepository);

    try {
        await (dependencies.deleteAssetFile ?? deleteFile)(getApplicationAssetStoragePath(applicationId, applicationAssetId));
        return true;
    } catch (error) {
        if (isMissingApplicationAssetStorageError(error)) return false;
        throw error;
    }
}

function sendUnknownApplicationAsset(res: Response) {
    return res.status(404).json({
        code: UNKNOWN_APPLICATION_ASSET.code,
        message: UNKNOWN_APPLICATION_ASSET.message,
    });
}

function sendApplicationAuthorizationError(res: Response) {
    return res.status(403).json({
        code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
        message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
    });
}

function isApplicationAuthorizationError(error: unknown) {
    return (error as { code?: unknown })?.code === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code;
}

export function createOAuth2ApplicationAssetRouter(dependencies: ApplicationAssetDeleteDependencies = {}) {
    const router: Router = createRouter({ mergeParams: true });

    router.delete(
        "/",
        route({
            summary: "Delete Application Asset",
            description: "Deletes an application asset owned by the given application.",
            responses: {
                204: {},
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
            try {
                const deleted = await deleteApplicationAsset(
                    req.params.application_id as string,
                    req.params.application_asset_id as string,
                    req.user_id,
                    dependencies,
                );
                if (!deleted) return sendUnknownApplicationAsset(res);

                return res.sendStatus(204);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createOAuth2ApplicationAssetRouter();
