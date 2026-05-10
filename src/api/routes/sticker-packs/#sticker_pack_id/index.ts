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
import type { StickerPackResponse, StickerResponse } from "@spacebar/schemas";
import { StickerPack, type Sticker } from "@spacebar/util";
import { Request, Response, Router } from "express";

type StickerPackWithOptionalSku = StickerPack & { sku_id?: string | null };
type StickerWithOptionalSort = Sticker & { sort_value?: number | null };

const router: Router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        summary: "Get Sticker Pack",
        responses: {
            200: {
                body: "StickerPackResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { sticker_pack_id } = req.params as { sticker_pack_id: string };
        const stickerPack = await StickerPack.findOneOrFail({
            where: { id: sticker_pack_id },
            relations: { stickers: true },
        });

        res.json(toStickerPackResponse(stickerPack));
    },
);

export function toStickerPackResponse(stickerPack: StickerPackWithOptionalSku): StickerPackResponse {
    const response: StickerPackResponse = {
        id: stickerPack.id,
        stickers: (stickerPack.stickers ?? []).map(toStickerResponse),
        name: stickerPack.name,
        description: stickerPack.description ?? null,
    };

    if (stickerPack.sku_id) response.sku_id = stickerPack.sku_id;
    if (stickerPack.cover_sticker_id) response.cover_sticker_id = stickerPack.cover_sticker_id;
    if (stickerPack.banner_asset_id) response.banner_asset_id = stickerPack.banner_asset_id;

    return response;
}

function toStickerResponse(sticker: StickerWithOptionalSort): StickerResponse {
    const response: StickerResponse = {
        id: sticker.id,
        name: sticker.name,
        description: sticker.description ?? null,
        tags: sticker.tags ?? "",
        type: sticker.type,
        format_type: sticker.format_type,
    };

    if (sticker.pack_id) response.pack_id = sticker.pack_id;
    if (typeof sticker.available === "boolean") response.available = sticker.available;
    if (sticker.guild_id) response.guild_id = sticker.guild_id;
    if (typeof sticker.sort_value === "number") response.sort_value = sticker.sort_value;

    return response;
}

export default router;
