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
import { Request, Response, Router } from "express";
import { VoiceStateUpdateSchema } from "@spacebar/schemas";
import { modifyVoiceState } from "../../../../../util/handlers/VoiceState";

const router = Router({ mergeParams: true });

router.patch(
    "/",
    route({
        requestBody: "VoiceStateUpdateSchema",
        event: "VOICE_STATE_UPDATE",
        responses: {
            204: {},
            400: {
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
        const body = req.body as VoiceStateUpdateSchema;
        const { guild_id } = req.params as { [key: string]: string };
        const user_id = req.params.user_id === "@me" ? req.user_id : (req.params.user_id as string);

        await modifyVoiceState(req.user_id, guild_id, user_id, body);
        return res.sendStatus(204);
    },
);

export default router;
