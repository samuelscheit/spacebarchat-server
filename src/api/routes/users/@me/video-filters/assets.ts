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
import type { VideoFilterAssetResponse, VideoFilterAssetsResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

export type CurrentUserVideoFilterAssetsProvider = (userId: string) => VideoFilterAssetsResponse | Promise<VideoFilterAssetsResponse>;

export function getCurrentUserVideoFilterAssets(_userId: string): VideoFilterAssetsResponse {
    // Spacebar currently has no durable custom video-filter asset catalog backing.
    return [];
}

function serializeVideoFilterAssets(assets: readonly VideoFilterAssetResponse[]): VideoFilterAssetsResponse {
    return assets.map((asset) => ({
        id: asset.id,
        asset_hash: asset.asset_hash,
    }));
}

export function createCurrentUserVideoFilterAssetsRouter(videoFilterAssetsProvider: CurrentUserVideoFilterAssetsProvider = getCurrentUserVideoFilterAssets) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Video Filter Assets",
            description: "Returns the current user's locally backed custom video-filter background assets without fabricating Discord private client media state.",
            responses: {
                200: {
                    body: "VideoFilterAssetsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const assets = await videoFilterAssetsProvider(req.user_id);

            res.status(200).json(serializeVideoFilterAssets(assets));
        },
    );

    return router;
}

export default createCurrentUserVideoFilterAssetsRouter();
