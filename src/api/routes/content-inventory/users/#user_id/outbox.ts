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
import type { ContentInventoryOutboxResponse } from "@spacebar/schemas";
import { User } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export function buildContentInventoryOutboxResponse(): ContentInventoryOutboxResponse {
    return [];
}

router.get(
    "/",
    route({
        summary: "Get Content Inventory Outbox",
        responses: {
            200: {
                body: "ContentInventoryOutboxResponse",
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
        const { user_id } = req.params as { user_id: string };

        await User.findOneOrFail({
            where: { id: user_id },
            select: { id: true },
        });

        res.status(200).json(buildContentInventoryOutboxResponse());
    },
);

export default router;
