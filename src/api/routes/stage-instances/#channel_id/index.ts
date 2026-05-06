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

import { route, deleteStageInstance, getStageInstance, modifyStageInstance } from "@spacebar/api";
import { StageInstanceModifySchema } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        permission: "VIEW_CHANNEL",
        responses: {
            200: {
                body: "StageInstanceResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { channel_id } = req.params as { channel_id: string };
        const response = await getStageInstance(channel_id);
        return res.status(200).json(response);
    },
);

router.patch(
    "/",
    route({
        requestBody: "StageInstanceModifySchema",
        responses: {
            200: {
                body: "StageInstanceResponse",
            },
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
        const { channel_id } = req.params as { channel_id: string };
        const response = await modifyStageInstance(req.user_id, channel_id, req.body as StageInstanceModifySchema);
        return res.status(200).json(response);
    },
);

router.delete(
    "/",
    route({
        responses: {
            204: {},
            403: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { channel_id } = req.params as { channel_id: string };
        await deleteStageInstance(req.user_id, channel_id);
        return res.sendStatus(204);
    },
);

export default router;
