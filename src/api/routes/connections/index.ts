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
import { ConnectionConfig } from "@spacebar/util";
import { Request, Response, Router } from "express";
const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "APIConnectionsConfiguration",
            },
        },
    }),
    (req: Request, res: Response) => {
        const config = Object.fromEntries(
            Object.entries(ConnectionConfig.get()).map(([key, value]) => {
                const publicConfig = { ...(value as Record<string, unknown>) };
                delete publicConfig.clientId;
                delete publicConfig.clientSecret;
                return [key, publicConfig];
            }),
        );

        res.json(config);
    },
);

export default router;
