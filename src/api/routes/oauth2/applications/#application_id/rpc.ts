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
import { Router } from "express";
import { createApplicationRpcRouteHandler, type ApplicationRpcRepositories } from "../../../../util/utility/ApplicationRpc";

export function createOAuth2ApplicationRpcRouter(repositories: ApplicationRpcRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get RPC Application",
            responses: {
                200: {
                    body: "ApplicationRpcResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        createApplicationRpcRouteHandler(repositories),
    );

    return router;
}

export default createOAuth2ApplicationRpcRouter();
