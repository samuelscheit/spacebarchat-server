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
import type { ConsoleDevicesResponse } from "@spacebar/schemas";
import { FieldErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export const SUPPORTED_CONSOLE_DEVICE_CONNECTION_TYPES = ["playstation", "playstation-stg"] as const;

export type ConsoleDeviceConnectionType = (typeof SUPPORTED_CONSOLE_DEVICE_CONNECTION_TYPES)[number];

export function isConsoleDeviceConnectionType(connectionType: string): connectionType is ConsoleDeviceConnectionType {
    return SUPPORTED_CONSOLE_DEVICE_CONNECTION_TYPES.includes(connectionType as ConsoleDeviceConnectionType);
}

export function getSupportedConsoleDeviceConnectionTypes(): string {
    return SUPPORTED_CONSOLE_DEVICE_CONNECTION_TYPES.join(", ");
}

router.get(
    "/",
    route({
        summary: "Get Console Devices",
        responses: {
            200: {
                body: "ConsoleDevicesResponse",
            },
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

        if (!isConsoleDeviceConnectionType(connection_type)) {
            throw FieldErrors({
                connection_type: {
                    code: "BASE_TYPE_CHOICES",
                    message: req.t("common:field.BASE_TYPE_CHOICES", {
                        types: getSupportedConsoleDeviceConnectionTypes(),
                    }),
                },
            });
        }

        res.json({
            devices: [],
        } satisfies ConsoleDevicesResponse);
    },
);

export default router;
