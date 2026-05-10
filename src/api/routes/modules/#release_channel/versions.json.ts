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
import { type NativeModuleVersionsResponse } from "@spacebar/schemas";
import { type Request, type Response, Router } from "express";

const router = Router({ mergeParams: true });

export function getNativeModuleVersions(): NativeModuleVersionsResponse {
    return {};
}

router.get(
    "/",
    route({
        summary: "Get Native Module Versions",
        query: {
            platform: {
                type: "string",
                description: "Desktop platform to get native module versions for. Defaults to osx.",
            },
            host_version: {
                type: "string",
                description: "Host version to get native module versions for. Defaults to 0.",
            },
        },
        responses: {
            200: {
                body: "NativeModuleVersionsResponse",
            },
        },
    }),
    (_req: Request, res: Response) => res.json(getNativeModuleVersions()),
);

export default router;
