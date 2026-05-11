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
import type { ApplicationCommandIndexResponse } from "@spacebar/schemas";
import { Snowflake } from "@spacebar/util";
import { type Request, type Response, Router } from "express";

export type UserApplicationCommandIndexOptions = {
    generateVersion?: () => string;
};

export function buildUserApplicationCommandIndexResponse(options: UserApplicationCommandIndexOptions = {}): ApplicationCommandIndexResponse {
    // Spacebar has no durable per-user application install table yet; keep the index truthful instead of fabricating Discord's user-installed commands.
    return {
        applications: [],
        application_commands: [],
        version: (options.generateVersion ?? Snowflake.generate)(),
    };
}

export function createUserApplicationCommandIndexRouter(options: UserApplicationCommandIndexOptions = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get User Application Command Index",
            responses: {
                200: {
                    body: "ApplicationCommandIndexResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (_req: Request, res: Response) => res.status(200).json(buildUserApplicationCommandIndexResponse(options)),
    );

    return router;
}

export default createUserApplicationCommandIndexRouter();
