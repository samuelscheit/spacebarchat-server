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
import {
    type ApplicationDirectoryApplication,
    type ApplicationDirectoryCategoriesResponse,
    type ApplicationDirectoryCategory,
    ApplicationDirectoryItemType,
    type ApplicationDirectorySearchResponse,
    type ApplicationDirectorySimilarApplicationsResponse,
} from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { type Request, type Response, Router, type Router as ExpressRouter } from "express";

export const APPLICATION_DIRECTORY_STATIC_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600";
export const APPLICATION_DIRECTORY_STATIC_EMPTY_SEARCH_LOAD_ID = "application_directory_search/empty";
export const APPLICATION_DIRECTORY_STATIC_EMPTY_SIMILAR_LOAD_ID = "application_directory_similar/empty";

type MaybePromise<T> = T | Promise<T>;

type ApplicationDirectoryCategoryDefinition = ApplicationDirectoryCategory & {
    localizations?: Record<string, string>;
};

export interface ApplicationDirectoryApplicationQueryOptions {
    locale?: string;
    nocache?: boolean;
    with_localizations?: boolean;
}

export interface ApplicationDirectorySearchQueryOptions {
    query?: string;
    guild_id?: string;
    page?: number;
    page_size?: number;
    category_id?: number;
    locale?: string;
    min_user_install_command_count?: number;
    exclude_apps_with_custom_install_url?: boolean;
    exclude_non_embedded_apps?: boolean;
    exclude_embedded_apps_without_primary_entry_point_app_command?: boolean;
    source?: number;
}

export interface ApplicationDirectorySimilarApplicationsQueryOptions {
    guild_id?: string;
    page: number;
    locale?: string;
}

export type ApplicationDirectoryApplicationProvider = (
    applicationId: string,
    options: ApplicationDirectoryApplicationQueryOptions,
) => MaybePromise<ApplicationDirectoryApplication | null | undefined>;
export type ApplicationDirectorySearchProvider = (options: ApplicationDirectorySearchQueryOptions) => ApplicationDirectorySearchResponse;
export type ApplicationDirectorySimilarApplicationsProvider = (
    applicationId: string,
    options: ApplicationDirectorySimilarApplicationsQueryOptions,
) => MaybePromise<ApplicationDirectorySimilarApplicationsResponse>;

export interface ApplicationDirectoryStaticRouterOptions {
    applicationProvider?: ApplicationDirectoryApplicationProvider;
    searchProvider?: ApplicationDirectorySearchProvider;
    similarApplicationsProvider?: ApplicationDirectorySimilarApplicationsProvider;
}

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

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return value[0];
    return value;
}

function firstString(value: unknown): string | undefined {
    const entry = firstQueryValue(value);
    if (typeof entry === "string") return entry;
    return undefined;
}

function parseOptionalString(value: unknown, options: { maxLength?: number } = {}): string | undefined {
    const entry = firstString(value);
    if (!entry) return undefined;
    if (options.maxLength !== undefined && entry.length > options.maxLength) return undefined;
    return entry;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
    const entry = firstQueryValue(value);
    if (typeof entry === "boolean") return entry;
    if (entry === "true") return true;
    if (entry === "false") return false;
    return undefined;
}

function parseOptionalInteger(value: unknown, options: { min?: number; max?: number } = {}): number | undefined {
    const entry = firstQueryValue(value);
    if (typeof entry === "number" && Number.isSafeInteger(entry)) return integerInRange(entry, options);
    if (typeof entry !== "string" || !/^-?\d+$/.test(entry)) return undefined;

    const parsed = Number.parseInt(entry, 10);
    return Number.isSafeInteger(parsed) ? integerInRange(parsed, options) : undefined;
}

function integerInRange(value: number, options: { min?: number; max?: number }): number | undefined {
    if (options.min !== undefined && value < options.min) return undefined;
    if (options.max !== undefined && value > options.max) return undefined;
    return value;
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

export function parseApplicationDirectoryApplicationQuery(query: Request["query"]): ApplicationDirectoryApplicationQueryOptions {
    return {
        locale: parseOptionalString(query.locale),
        nocache: parseOptionalBoolean(query.nocache),
        with_localizations: parseOptionalBoolean(query.with_localizations),
    };
}

export function parseApplicationDirectorySearchQuery(query: Request["query"]): ApplicationDirectorySearchQueryOptions {
    return {
        query: parseOptionalString(query.query, { maxLength: 100 }),
        guild_id: parseOptionalString(query.guild_id),
        page: parseOptionalInteger(query.page, { min: 1, max: 1000 }),
        page_size: parseOptionalInteger(query.page_size, { min: 1, max: 100 }),
        category_id: parseOptionalInteger(query.category_id),
        locale: parseOptionalString(query.locale),
        min_user_install_command_count: parseOptionalInteger(query.min_user_install_command_count, { min: 0, max: 100 }),
        exclude_apps_with_custom_install_url: parseOptionalBoolean(query.exclude_apps_with_custom_install_url),
        exclude_non_embedded_apps: parseOptionalBoolean(query.exclude_non_embedded_apps),
        exclude_embedded_apps_without_primary_entry_point_app_command: parseOptionalBoolean(query.exclude_embedded_apps_without_primary_entry_point_app_command),
        source: parseOptionalInteger(query.source),
    };
}

export function parseApplicationDirectorySimilarApplicationsQuery(query: Request["query"]): ApplicationDirectorySimilarApplicationsQueryOptions {
    return {
        guild_id: parseOptionalString(query.guild_id),
        page: parseOptionalInteger(query.page, { min: 1, max: 1000 }) ?? 1,
        locale: parseOptionalString(query.locale),
    };
}

export function getApplicationDirectoryApplication(
    _applicationId: string,
    _options: ApplicationDirectoryApplicationQueryOptions = {},
): ApplicationDirectoryApplication | undefined {
    // Spacebar currently has no source-backed static App Directory application catalog.
    return undefined;
}

export function getApplicationDirectorySearchResults(_options: ApplicationDirectorySearchQueryOptions = {}): ApplicationDirectorySearchResponse {
    return {
        results: [],
        num_pages: 0,
        counts_by_category: {},
        type: ApplicationDirectoryItemType.APPLICATION,
        load_id: APPLICATION_DIRECTORY_STATIC_EMPTY_SEARCH_LOAD_ID,
    };
}

export function getApplicationDirectorySimilarApplications(
    _applicationId: string,
    _options: ApplicationDirectorySimilarApplicationsQueryOptions = { page: 1 },
): ApplicationDirectorySimilarApplicationsResponse {
    return {
        applications: [],
        num_pages: 0,
        load_id: APPLICATION_DIRECTORY_STATIC_EMPTY_SIMILAR_LOAD_ID,
    };
}

export function createApplicationDirectoryStaticRouter(options: ApplicationDirectoryStaticRouterOptions = {}): ExpressRouter {
    const router = Router({ mergeParams: true });
    const applicationProvider = options.applicationProvider ?? getApplicationDirectoryApplication;
    const searchProvider = options.searchProvider ?? getApplicationDirectorySearchResults;
    const similarApplicationsProvider = options.similarApplicationsProvider ?? getApplicationDirectorySimilarApplications;

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

    router.get(
        "/applications/:application_id",
        route({
            summary: "Get Application Directory Application",
            query: {
                locale: {
                    type: "string",
                    description: "Locale to use when returning application directory details.",
                },
                nocache: {
                    type: "boolean",
                    description: "Whether the backing application directory provider should bypass its cache.",
                },
                with_localizations: {
                    type: "boolean",
                    description: "Whether to include source-backed localized directory descriptions.",
                },
            },
            responses: {
                200: {
                    body: "ApplicationDirectoryApplication",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const applicationId = req.params.application_id;
            if (typeof applicationId !== "string" || applicationId.length === 0) throw DiscordApiErrors.UNKNOWN_APPLICATION;

            const application = await applicationProvider(applicationId, parseApplicationDirectoryApplicationQuery(req.query));
            if (!application) throw DiscordApiErrors.UNKNOWN_APPLICATION;

            res.set("Cache-Control", APPLICATION_DIRECTORY_STATIC_CACHE_CONTROL).status(200).json(application);
        },
    );

    router.get(
        "/applications/:application_id/similar",
        route({
            summary: "Get Application Directory Similar Applications",
            query: {
                guild_id: {
                    type: "string",
                    description: "Guild ID the application directory request originated from.",
                },
                page: {
                    type: "integer",
                    description: "Page of similar application results to fetch. Discord documents pages from 1 to 1000.",
                },
                locale: {
                    type: "string",
                    description: "Locale to use when returning similar application details.",
                },
            },
            responses: {
                200: {
                    body: "ApplicationDirectorySimilarApplicationsResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const applicationId = req.params.application_id;
            if (typeof applicationId !== "string" || applicationId.length === 0) throw DiscordApiErrors.UNKNOWN_APPLICATION;

            const query = parseApplicationDirectorySimilarApplicationsQuery(req.query);
            const application = await applicationProvider(applicationId, {
                locale: query.locale,
                nocache: undefined,
                with_localizations: undefined,
            });
            if (!application) throw DiscordApiErrors.UNKNOWN_APPLICATION;

            const response = await similarApplicationsProvider(applicationId, query);

            res.set("Cache-Control", APPLICATION_DIRECTORY_STATIC_CACHE_CONTROL).status(200).json(response);
        },
    );

    router.get(
        "/search",
        route({
            summary: "Search Applications Directory",
            query: {
                query: {
                    type: "string",
                    description: "Application directory search text to match. Discord documents a maximum of 100 characters.",
                },
                guild_id: {
                    type: "string",
                    description: "Guild that originated the application directory search request.",
                },
                page: {
                    type: "integer",
                    description: "Search result page to return. Discord documents pages from 1 to 1000.",
                },
                page_size: {
                    type: "integer",
                    description: "Maximum search results per page. Discord documents values from 1 to 100.",
                },
                category_id: {
                    type: "integer",
                    description: "Application directory category to filter by.",
                },
                locale: {
                    type: "string",
                    description: "Locale to use when returning application directory search results.",
                },
                min_user_install_command_count: {
                    type: "integer",
                    description: "Minimum user-install command count to filter by. Discord documents a maximum of 100.",
                },
                exclude_apps_with_custom_install_url: {
                    type: "boolean",
                    description: "Whether applications with custom install URLs are excluded.",
                },
                exclude_non_embedded_apps: {
                    type: "boolean",
                    description: "Whether applications without the embedded flag are excluded.",
                },
                exclude_embedded_apps_without_primary_entry_point_app_command: {
                    type: "boolean",
                    description: "Whether embedded applications without a primary entry point command are excluded.",
                },
                source: {
                    type: "integer",
                    description: "Application directory request surface that originated the search.",
                },
            },
            responses: {
                200: {
                    body: "ApplicationDirectorySearchResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const response = searchProvider(parseApplicationDirectorySearchQuery(req.query));

            res.set("Cache-Control", APPLICATION_DIRECTORY_STATIC_CACHE_CONTROL).status(200).json(response);
        },
    );

    return router;
}

export default createApplicationDirectoryStaticRouter();
