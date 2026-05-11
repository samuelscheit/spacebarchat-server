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
import { ApiError, ApplicationStoreAsset, DiscordApiErrors, deleteFile } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import { requireApplicationStoreAssetAccess, type ApplicationCommandAuthorizationRepository } from "../../../../../util/utility/ApplicationAuthorization";

const routeSnowflakePattern = /^[1-9]\d{16,19}$/;

export const UNKNOWN_APPLICATION_STORE_ASSET = new ApiError("Unknown Store Asset", 10046, 404);

export type ApplicationStoreAssetRecord = {
    id: string;
    application_id?: string;
};

export type ApplicationStoreAssetRepository = {
    findOne(options: unknown): Promise<ApplicationStoreAssetRecord | null>;
    delete(criteria: unknown): Promise<unknown>;
};

export type ApplicationStoreAssetDeleteDependencies = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    assetRepository?: ApplicationStoreAssetRepository;
    deleteAssetFile?: (path: string) => Promise<unknown>;
};

function getApplicationStoreAssetRepository(repository?: ApplicationStoreAssetRepository): ApplicationStoreAssetRepository {
    return repository ?? (ApplicationStoreAsset as unknown as ApplicationStoreAssetRepository);
}

export function isStoreAssetRouteSnowflake(value: string) {
    return routeSnowflakePattern.test(value);
}

export function normalizeStoreAssetRouteId(value: string) {
    return value.split(".")[0];
}

export function getApplicationStoreAssetStoragePath(applicationId: string, assetId: string) {
    return `/store-assets/${applicationId}/${assetId}`;
}

export async function deleteApplicationStoreAsset(
    applicationId: string,
    assetId: string,
    userId: string,
    dependencies: ApplicationStoreAssetDeleteDependencies = {},
) {
    if (!isStoreAssetRouteSnowflake(applicationId)) throw DiscordApiErrors.UNKNOWN_APPLICATION;
    const normalizedAssetId = normalizeStoreAssetRouteId(assetId);
    if (!isStoreAssetRouteSnowflake(normalizedAssetId)) throw UNKNOWN_APPLICATION_STORE_ASSET;

    await requireApplicationStoreAssetAccess(applicationId, userId, dependencies.applicationRepository);

    const assetRepository = getApplicationStoreAssetRepository(dependencies.assetRepository);
    const asset = await assetRepository.findOne({
        where: {
            id: normalizedAssetId,
            application_id: applicationId,
        },
    });

    if (!asset) return false;

    await assetRepository.delete({
        id: asset.id,
        application_id: applicationId,
    });
    await (dependencies.deleteAssetFile ?? deleteFile)(getApplicationStoreAssetStoragePath(applicationId, asset.id));

    return true;
}

function sendApplicationAuthorizationError(res: Response) {
    return res.status(403).json({
        code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
        message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
    });
}

function sendUnknownApplicationStoreAsset(res: Response) {
    return res.status(404).json({
        code: UNKNOWN_APPLICATION_STORE_ASSET.code,
        message: UNKNOWN_APPLICATION_STORE_ASSET.message,
    });
}

function isApplicationAuthorizationError(error: unknown) {
    return (error as { code?: unknown })?.code === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code;
}

export function createApplicationStoreAssetRouter(dependencies: ApplicationStoreAssetDeleteDependencies = {}) {
    const router: Router = createRouter({ mergeParams: true });

    router.delete(
        "/",
        route({
            summary: "Delete Application Store Asset",
            description: "Deletes a store asset owned by the given application.",
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
                const deleted = await deleteApplicationStoreAsset(req.params.application_id as string, req.params.asset_id as string, req.user_id, dependencies);
                if (!deleted) return sendUnknownApplicationStoreAsset(res);

                return res.sendStatus(204);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createApplicationStoreAssetRouter();
