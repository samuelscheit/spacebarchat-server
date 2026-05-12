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
import type { StickerPacksDirectoryResponse } from "@spacebar/schemas";
import { StickerPack } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { toStickerPackResponse } from "../../../../util/utility/StickerPack";

type StickerPackWithOptionalSku = StickerPack & { sku_id?: string | null };

export type StickerPacksDirectoryProvider = (param: string) => Promise<readonly StickerPackWithOptionalSku[]>;

export async function getStickerPacksDirectory(_param: string): Promise<readonly StickerPackWithOptionalSku[]> {
    return StickerPack.find({
        relations: { stickers: true },
    });
}

export function createStickerPacksDirectoryV2Router(stickerPacksProvider: StickerPacksDirectoryProvider = getStickerPacksDirectory) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Sticker Packs Directory",
            description: "Returns locally persisted sticker packs for a sticker-pack directory request without Discord storefront ranking or entitlement metadata.",
            responses: {
                200: {
                    body: "StickerPacksDirectoryResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const { param } = req.params as { param: string };
            const stickerPacks = await stickerPacksProvider(param);
            const response: StickerPacksDirectoryResponse = {
                sticker_packs: stickerPacks.map(toStickerPackResponse),
            };

            res.status(200).json(response);
        },
    );

    return router;
}

export default createStickerPacksDirectoryV2Router();
