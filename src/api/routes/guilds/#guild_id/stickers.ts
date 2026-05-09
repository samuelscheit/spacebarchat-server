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
import { GuildStickersUpdateEvent, Member, Snowflake, Sticker, emitEvent, Config, DiscordApiErrors, deleteFile, uploadFile } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import multer from "multer";
import { ModifyGuildStickerSchema } from "@spacebar/schemas";
import { UnsupportedStickerMimeTypeError, createGuildStickerUpload } from "../../../util/StickerUpload";
const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "StickersResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id } = req.params as { [key: string]: string };
        await Member.IsInGuildOrFail(req.user_id, guild_id);

        res.json(await Sticker.find({ where: { guild_id } }));
    },
);

const bodyParser = multer({
    limits: {
        fileSize: 1024 * 1024 * 100,
        fields: 10,
        files: 1,
    },
    storage: multer.memoryStorage(),
}).single("file");

router.post(
    "/",
    bodyParser,
    route({
        permission: "MANAGE_EMOJIS_AND_STICKERS",
        requestBody: "ModifyGuildStickerSchema",
        responses: {
            200: {
                body: "Sticker",
            },
            400: {
                body: "APIErrorResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        if (!req.file) throw new HTTPError("missing file");

        const { guild_id } = req.params as { [key: string]: string };
        const body = req.body as ModifyGuildStickerSchema;
        const id = Snowflake.generate();

        const sticker_count = await Sticker.count({
            where: { guild_id: guild_id },
        });
        const { maxStickers } = Config.get().limits.guild;

        if (sticker_count >= maxStickers) throw DiscordApiErrors.MAXIMUM_STICKERS.withParams(maxStickers);

        const sticker = await createGuildStickerUpload({
            body,
            createSticker: (metadata) => Sticker.create(metadata),
            deleteUploadedFile: deleteFile,
            file: req.file,
            guild_id,
            id,
            saveSticker: (sticker) => sticker.save(),
            upload: uploadFile,
            user_id: req.user_id,
        }).catch((error) => {
            if (error instanceof UnsupportedStickerMimeTypeError) throw new HTTPError(error.message);
            throw error;
        });

        await sendStickerUpdateEvent(guild_id);

        res.json(sticker);
    },
);

router.get(
    "/:sticker_id",
    route({
        responses: {
            200: {
                body: "Sticker",
            },
            403: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id, sticker_id } = req.params as { [key: string]: string };
        await Member.IsInGuildOrFail(req.user_id, guild_id);

        res.json(
            await Sticker.findOneOrFail({
                where: { guild_id, id: sticker_id },
            }),
        );
    },
);

router.patch(
    "/:sticker_id",
    route({
        requestBody: "ModifyGuildStickerSchema",
        permission: "MANAGE_EMOJIS_AND_STICKERS",
        responses: {
            200: {
                body: "Sticker",
            },
            400: {
                body: "APIErrorResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id, sticker_id } = req.params as { [key: string]: string };
        const body = req.body as ModifyGuildStickerSchema;

        const sticker = await Sticker.create({
            ...body,
            guild_id,
            id: sticker_id,
        }).save();
        await sendStickerUpdateEvent(guild_id);

        return res.json(sticker);
    },
);

async function sendStickerUpdateEvent(guild_id: string) {
    return emitEvent({
        event: "GUILD_STICKERS_UPDATE",
        guild_id: guild_id,
        data: {
            guild_id: guild_id,
            stickers: await Sticker.find({ where: { guild_id: guild_id } }),
        },
    } satisfies GuildStickersUpdateEvent);
}

router.delete(
    "/:sticker_id",
    route({
        permission: "MANAGE_EMOJIS_AND_STICKERS",
        responses: {
            204: {},
            403: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id, sticker_id } = req.params as { [key: string]: string };

        await Sticker.delete({ guild_id, id: sticker_id });
        await sendStickerUpdateEvent(guild_id);

        return res.sendStatus(204);
    },
);

export default router;
