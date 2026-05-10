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

import { createDiscoveryCategoryFindOptions, route } from "@spacebar/api";
import { type DiscoveryValidTermResponse } from "@spacebar/schemas";
import { Categories, FieldErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });
const MAX_DISCOVERY_SEARCH_TERM_LENGTH = 100;

type DiscoveryCategoryResponse = Pick<Categories, "id" | "name" | "localizations" | "is_primary" | "icon">;

export function localizeDiscoveryCategories(categories: Categories[], locale: unknown): DiscoveryCategoryResponse[] {
    if (typeof locale !== "string" || locale.length === 0) return categories;

    return categories.map((category) => {
        const name = category.localizations?.[locale];
        if (!name) return category;

        return { ...category, name };
    });
}

export async function getDiscoveryCategories(query: Request["query"]): Promise<DiscoveryCategoryResponse[]> {
    const { locale, primary_only } = query;
    const categories = await Categories.find(createDiscoveryCategoryFindOptions(primary_only));

    return localizeDiscoveryCategories(categories, locale);
}

export function parseDiscoverySearchTerm(term: unknown): string {
    if (typeof term === "string") return term;

    throw FieldErrors({
        term: {
            message: "This field is required",
        },
    });
}

export function isDiscoverySearchTermValid(term: string): boolean {
    const trimmed = term.trim();

    return trimmed.length > 0 && trimmed.length <= MAX_DISCOVERY_SEARCH_TERM_LENGTH;
}

export function getDiscoveryValidTermResponse(query: Request["query"]): DiscoveryValidTermResponse {
    return {
        valid: isDiscoverySearchTermValid(parseDiscoverySearchTerm(query.term)),
    };
}

router.get(
    "/valid-term",
    route({
        summary: "Validate Discovery Search Term",
        query: {
            term: {
                type: "string",
                required: true,
                description: "The search term to validate.",
            },
        },
        responses: {
            200: {
                body: "DiscoveryValidTermResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => res.status(200).json(getDiscoveryValidTermResponse(req.query)),
);

router.get(
    "/categories",
    route({
        query: {
            locale: {
                type: "string",
                description: "Locale to use when selecting localized category names.",
            },
            primary_only: {
                type: "boolean",
                description: "Only return primary discovery categories.",
            },
        },
        responses: {
            200: {
                body: "APIDiscoveryCategoryArray",
            },
        },
    }),
    async (req: Request, res: Response) => {
        res.send(await getDiscoveryCategories(req.query));
    },
);

export default router;
