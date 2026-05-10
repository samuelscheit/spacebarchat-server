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
import { type ApplicationDirectoryCategoriesResponse, type ApplicationDirectoryCategory } from "@spacebar/schemas";
import { type Request, type Response, Router } from "express";

const router = Router({ mergeParams: true });

export const APPLICATION_DIRECTORY_STATIC_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600";

type ApplicationDirectoryCategoryDefinition = ApplicationDirectoryCategory & {
    localizations?: Record<string, string>;
};

// Application-directory categories are a separate static set from guild discovery categories.
// Default names are en-US; localized names are included only where source-backed.
export const APPLICATION_DIRECTORY_CATEGORIES: readonly ApplicationDirectoryCategoryDefinition[] = [
    {
        id: 6,
        name: "Games",
        localizations: {
            de: "Spiele",
            fr: "Jeux",
            "es-ES": "Juegos",
            "pt-BR": "Jogos",
        },
    },
    {
        id: 4,
        name: "Entertainment",
        localizations: {
            de: "Unterhaltung",
            fr: "Divertissements",
            "es-ES": "Entretenimiento",
            "pt-BR": "Entretenimento",
        },
    },
    {
        id: 8,
        name: "Moderation and Tools",
        localizations: {
            de: "Moderation und Tools",
            fr: "Mod\u00e9ration et Outils",
            "es-ES": "Moderaci\u00f3n y herramientas",
            "pt-BR": "Modera\u00e7\u00e3o e ferramentas",
        },
    },
    {
        id: 9,
        name: "Social",
        localizations: {
            de: "Miteinander",
            fr: "Social",
            "es-ES": "Social",
            "pt-BR": "Social",
        },
    },
    {
        id: 10,
        name: "Utilities",
        localizations: {
            de: "N\u00fctzliches",
            fr: "Services",
            "es-ES": "Servicios",
            "pt-BR": "Utilidades",
        },
    },
] as const;

function firstString(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.find((entry): entry is string => typeof entry === "string");
    return undefined;
}

export function toApplicationDirectoryCategory(category: ApplicationDirectoryCategoryDefinition, locale: unknown): ApplicationDirectoryCategory {
    const requestedLocale = firstString(locale);
    const localizedName = requestedLocale ? category.localizations?.[requestedLocale] : undefined;

    return {
        id: category.id,
        name: localizedName ?? category.name,
    };
}

export function getApplicationDirectoryCategories(query: Request["query"]): ApplicationDirectoryCategoriesResponse {
    return APPLICATION_DIRECTORY_CATEGORIES.map((category) => toApplicationDirectoryCategory(category, query.locale));
}

router.get(
    "/categories",
    route({
        summary: "Get Application Directory Categories",
        query: {
            locale: {
                type: "string",
                description: "Locale to use when selecting localized application directory category names.",
            },
        },
        responses: {
            200: {
                body: "ApplicationDirectoryCategoriesResponse",
            },
        },
    }),
    (req: Request, res: Response) => {
        res.set("Cache-Control", APPLICATION_DIRECTORY_STATIC_CACHE_CONTROL).status(200).json(getApplicationDirectoryCategories(req.query));
    },
);

export default router;
