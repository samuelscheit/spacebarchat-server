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
import type { StoreEulaResponse } from "@spacebar/schemas";
import { ApiError, Config, type StoreEulaConfiguration } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";

const routeSnowflakePattern = /^[1-9]\d{16,19}$/;

export type StoreEulaSource = StoreEulaConfiguration | StoreEulaResponse;
export type StoreEulaProvider = (eulaId: string) => StoreEulaSource | undefined;

export const UNKNOWN_EULA_ERROR = new ApiError("Unknown EULA", 10044, 404);

export function assertValidStoreEulaId(eulaId: string): void {
    if (!routeSnowflakePattern.test(eulaId)) throw UNKNOWN_EULA_ERROR;
}

export function toStoreEulaResponse(eula: StoreEulaSource): StoreEulaResponse {
    return {
        id: eula.id,
        name: eula.name,
        content: eula.content,
    };
}

export function findStoreEula(eulaId: string, eulas: readonly StoreEulaSource[] = Config.get().store.customEulas): StoreEulaResponse | undefined {
    assertValidStoreEulaId(eulaId);

    const eula = eulas.find((entry) => entry.id === eulaId);
    return eula ? toStoreEulaResponse(eula) : undefined;
}

export function getStoreEula(eulaId: string, eulaProvider?: StoreEulaProvider): StoreEulaResponse {
    assertValidStoreEulaId(eulaId);

    const eula = eulaProvider ? eulaProvider(eulaId) : findStoreEula(eulaId);
    if (!eula) throw UNKNOWN_EULA_ERROR;

    return toStoreEulaResponse(eula);
}

export function createStoreEulasRouter(eulaProvider?: StoreEulaProvider) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get EULA",
            description: "Returns the EULA object for the given EULA ID.",
            responses: {
                200: {
                    body: "StoreEulaResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const response = getStoreEula(req.params.eula_id as string, eulaProvider);

            res.status(200).json(response);
        },
    );

    return router;
}

export default createStoreEulasRouter();
