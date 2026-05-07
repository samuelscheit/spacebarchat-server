/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTIBILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { createUserInvite, route } from "@spacebar/api";
import { UserInviteCreateSchema } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

router.post(
    "/",
    route({
        requestBody: "UserInviteCreateSchema",
        right: "INVITE_USERS",
        responses: {
            201: {
                body: "UserInviteResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const invite = await createUserInvite(req.user_id, req.body as UserInviteCreateSchema);
        res.status(201).send(invite);
    },
);

export default router;
