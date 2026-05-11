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
import { FieldErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { getSupportedConsoleDeviceConnectionTypes, isConsoleDeviceConnectionType } from "../../../devices";

const router: Router = Router({ mergeParams: true });

export function assertSupportedConsoleCommandConnectionType(connectionType: string, req: Request): void {
    if (isConsoleDeviceConnectionType(connectionType)) return;

    throw FieldErrors({
        connection_type: {
            code: "BASE_TYPE_CHOICES",
            message: req.t("common:field.BASE_TYPE_CHOICES", {
                types: getSupportedConsoleDeviceConnectionTypes(),
            }),
        },
    });
}

router.delete(
    "/",
    route({
        summary: "Cancel Console Command",
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => {
        const { connection_type } = req.params as { connection_type: string };
        assertSupportedConsoleCommandConnectionType(connection_type, req);

        return res.sendStatus(204);
    },
);

export default router;
