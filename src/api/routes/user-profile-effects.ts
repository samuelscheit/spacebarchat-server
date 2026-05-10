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
import type { UserProfileEffectConfig, UserProfileEffectsResponse } from "@spacebar/schemas";
import { Router as createRouter, type Request, type Response, type Router } from "express";

const emptyProfileEffectsCatalog: readonly UserProfileEffectConfig[] = [];

export interface UserProfileEffectsQueryOptions {
    locale?: string;
    with_unpublished?: boolean;
}

export type UserProfileEffectsCatalogProvider = (options: UserProfileEffectsQueryOptions) => readonly UserProfileEffectConfig[];

export function getUserProfileEffectsCatalog(_options: UserProfileEffectsQueryOptions = {}): readonly UserProfileEffectConfig[] {
    // Spacebar currently has no bundled or persisted profile-effect asset catalog backing.
    return emptyProfileEffectsCatalog;
}

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return value[0];
    return value;
}

function parseOptionalString(value: unknown): string | undefined {
    const entry = firstQueryValue(value);
    return typeof entry === "string" && entry.length > 0 ? entry : undefined;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
    const entry = firstQueryValue(value);
    if (typeof entry === "boolean") return entry;
    if (entry === "true") return true;
    if (entry === "false") return false;
    return undefined;
}

export function parseUserProfileEffectsQuery(query: Request["query"]): UserProfileEffectsQueryOptions {
    return {
        locale: parseOptionalString(query.locale),
        with_unpublished: parseOptionalBoolean(query.with_unpublished),
    };
}

export function buildUserProfileEffectsResponse(profileEffects: readonly UserProfileEffectConfig[]): UserProfileEffectsResponse {
    return {
        profile_effect_configs: Array.from(profileEffects),
    };
}

export function createUserProfileEffectsRouter(catalogProvider: UserProfileEffectsCatalogProvider = getUserProfileEffectsCatalog) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Profile Effects",
            deprecated: true,
            query: {
                locale: {
                    type: "string",
                    description: "Locale used for profile effect display strings.",
                },
                with_unpublished: {
                    type: "boolean",
                    description: "Whether to include unpublished profile effects.",
                },
            },
            responses: {
                200: {
                    body: "UserProfileEffectsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const options = parseUserProfileEffectsQuery(req.query);
            res.status(200).json(buildUserProfileEffectsResponse(catalogProvider(options)));
        },
    );

    return router;
}

export default createUserProfileEffectsRouter();
