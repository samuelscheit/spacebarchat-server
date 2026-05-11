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
import type { ApplicationStoreAssetResponse, ApplicationStoreAssetsResponse } from "@spacebar/schemas";
import { ApplicationStoreAsset, DiscordApiErrors } from "@spacebar/util";
import { type Request, type Response, Router } from "express";
import { requireApplicationStoreAssetAccess, type ApplicationCommandAuthorizationRepository } from "../../../../../util/utility/ApplicationAuthorization";

const routeSnowflakePattern = /^[1-9]\d{16,19}$/;

export type ApplicationStoreAssetListRecord = {
    id: string;
    size: number;
    mime_type: string;
    filename: string;
    width: number;
    height: number;
    application_id?: string;
};

export type ApplicationStoreAssetListRepository = {
    find(options: unknown): Promise<ApplicationStoreAssetListRecord[]>;
};

export type ApplicationStoreAssetListDependencies = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    assetRepository?: ApplicationStoreAssetListRepository;
};

function getApplicationStoreAssetRepository(repository?: ApplicationStoreAssetListRepository): ApplicationStoreAssetListRepository {
    return repository ?? (ApplicationStoreAsset as unknown as ApplicationStoreAssetListRepository);
}

export function isApplicationStoreAssetListRouteSnowflake(value: string) {
    return routeSnowflakePattern.test(value);
}

export function toApplicationStoreAssetResponse(asset: ApplicationStoreAssetListRecord): ApplicationStoreAssetResponse {
    return {
        id: asset.id,
        size: asset.size,
        mime_type: asset.mime_type,
        filename: asset.filename,
        width: asset.width,
        height: asset.height,
    };
}

export async function getApplicationStoreAssets(
    applicationId: string,
    userId: string,
    dependencies: ApplicationStoreAssetListDependencies = {},
): Promise<ApplicationStoreAssetsResponse> {
    if (!isApplicationStoreAssetListRouteSnowflake(applicationId)) throw DiscordApiErrors.UNKNOWN_APPLICATION;

    await requireApplicationStoreAssetAccess(applicationId, userId, dependencies.applicationRepository);

    const assetRepository = getApplicationStoreAssetRepository(dependencies.assetRepository);
    const assets = await assetRepository.find({
        where: {
            application_id: applicationId,
        },
        order: {
            id: "ASC",
        },
    });

    return assets.map(toApplicationStoreAssetResponse);
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

export function createApplicationStoreAssetsRouter(dependencies: ApplicationStoreAssetListDependencies = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Application Store Assets",
            description: "Returns persisted store assets owned by the given application.",
            responses: {
                200: {
                    body: "ApplicationStoreAssetsResponse",
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
            try {
                const assets = await getApplicationStoreAssets(req.params.application_id as string, req.user_id, dependencies);

                return res.status(200).json(assets);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createApplicationStoreAssetsRouter();
