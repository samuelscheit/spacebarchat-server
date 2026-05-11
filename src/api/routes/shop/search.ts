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
import type { CollectiblesCategory, CollectiblesCategoryProduct, CollectiblesProductVariant, CollectiblesSearchResponse } from "@spacebar/schemas";
import { Router as createRouter, type Request, type Response, type Router } from "express";

const emptyCollectiblesCatalog: readonly CollectiblesCategory[] = [];

export const COLLECTIBLES_SEARCH_DEFAULT_LIMIT = 20;
export const COLLECTIBLES_SEARCH_MAX_LIMIT = 100;
export const COLLECTIBLES_SEARCH_MAX_QUERY_LENGTH = 256;

const productTypeByShopItemType = new Map<string, number>([
    ["AVATAR_DECORATION", 0],
    ["PROFILE_EFFECT", 1],
    ["NAMEPLATE", 2],
    ["BUNDLE", 1000],
]);

const supportedSortTypes = new Set(["relevance", "price", "alphabetical", "recency", "popularity"]);
const supportedSortDirections = new Set(["asc", "desc"]);

export interface CollectiblesSearchQueryOptions {
    item_types: string[];
    colors: string[];
    themes: string[];
    orbs_eligible?: boolean;
    offset: number;
    limit: number;
    sort_type?: string;
    sort_direction: "asc" | "desc";
    search?: string;
}

export type CollectiblesSearchCatalogProvider = (options: CollectiblesSearchQueryOptions) => readonly CollectiblesCategory[];

type SearchableCollectible = {
    category: CollectiblesCategory;
    product: CollectiblesCategoryProduct | CollectiblesProductVariant;
    index: number;
    ranking: number;
};

export function getCollectiblesSearchCatalog(_options: CollectiblesSearchQueryOptions): readonly CollectiblesCategory[] {
    // Spacebar currently has no persisted collectible shop catalog backing.
    return emptyCollectiblesCatalog;
}

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return value[0];
    return value;
}

function queryValues(...values: unknown[]): string[] {
    const output: string[] = [];

    for (const value of values) {
        if (Array.isArray(value)) {
            for (const entry of value) {
                if (typeof entry === "string") output.push(...entry.split(","));
            }
        } else if (typeof value === "string") {
            output.push(...value.split(","));
        }
    }

    return output.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
    const entry = firstQueryValue(value);
    if (typeof entry === "boolean") return entry;
    if (entry === "true") return true;
    if (entry === "false") return false;
    return undefined;
}

function parseOptionalNonNegativeInteger(value: unknown): number | undefined {
    const entry = firstQueryValue(value);
    if (typeof entry === "number" && Number.isSafeInteger(entry) && entry >= 0) return entry;
    if (typeof entry !== "string" || !/^\d+$/.test(entry)) return undefined;

    const parsed = Number.parseInt(entry, 10);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function parseLimit(value: unknown): number {
    const parsed = parseOptionalNonNegativeInteger(value);
    if (parsed === undefined) return COLLECTIBLES_SEARCH_DEFAULT_LIMIT;
    return Math.min(parsed, COLLECTIBLES_SEARCH_MAX_LIMIT);
}

function parseOptionalBoundedString(value: unknown, maxLength: number): string | undefined {
    const entry = firstQueryValue(value);
    if (typeof entry !== "string") return undefined;

    const normalized = entry.trim();
    if (normalized.length === 0 || normalized.length > maxLength) return undefined;
    return normalized;
}

function parseOptionalEnum(value: unknown, supportedValues: ReadonlySet<string>): string | undefined {
    const entry = parseOptionalBoundedString(value, 64);
    return entry && supportedValues.has(entry) ? entry : undefined;
}

export function parseCollectiblesSearchQuery(query: Request["query"]): CollectiblesSearchQueryOptions {
    return {
        item_types: queryValues(query.item_types, query["item_types[]"]),
        colors: queryValues(query.colors, query["colors[]"]),
        themes: queryValues(query.themes, query["themes[]"]),
        orbs_eligible: parseOptionalBoolean(query.orbs_eligible),
        offset: parseOptionalNonNegativeInteger(query.offset) ?? 0,
        limit: parseLimit(query.limit),
        sort_type: parseOptionalEnum(query.sort_type, supportedSortTypes),
        sort_direction: (parseOptionalEnum(query.sort_direction, supportedSortDirections) as "asc" | "desc" | undefined) ?? "desc",
        search: parseOptionalBoundedString(query.search, COLLECTIBLES_SEARCH_MAX_QUERY_LENGTH),
    };
}

function productTypeMatches(product: CollectiblesCategoryProduct | CollectiblesProductVariant, itemTypes: readonly string[]): boolean {
    if (itemTypes.length === 0) return true;

    const requestedTypes = itemTypes.map((itemType) => productTypeByShopItemType.get(itemType)).filter((itemType): itemType is number => itemType !== undefined);
    if (requestedTypes.length === 0) return false;

    return requestedTypes.includes(product.type) || product.items.some((item) => requestedTypes.includes(item.type));
}

function containsSearchTerm(value: string | null | undefined, normalizedSearch: string): boolean {
    return typeof value === "string" && value.toLocaleLowerCase().includes(normalizedSearch);
}

function productTextMatches(entry: SearchableCollectible, search: string | undefined): boolean {
    if (!search) return true;

    const normalizedSearch = search.toLocaleLowerCase();
    const { category, product } = entry;
    if (
        containsSearchTerm(product.sku_id, normalizedSearch) ||
        containsSearchTerm(product.name, normalizedSearch) ||
        containsSearchTerm(product.summary, normalizedSearch) ||
        containsSearchTerm(category.sku_id, normalizedSearch) ||
        containsSearchTerm(category.name, normalizedSearch) ||
        containsSearchTerm(category.summary, normalizedSearch)
    ) {
        return true;
    }

    return product.items.some(
        (item) =>
            containsSearchTerm(item.sku_id, normalizedSearch) ||
            containsSearchTerm(item.id, normalizedSearch) ||
            containsSearchTerm(item.label, normalizedSearch) ||
            containsSearchTerm(item.palette, normalizedSearch),
    );
}

function firstProductPrice(product: CollectiblesCategoryProduct | CollectiblesProductVariant): number | undefined {
    for (const priceGroup of Object.values(product.prices)) {
        const price = priceGroup.country_prices.prices[0]?.amount;
        if (typeof price === "number") return price;
    }

    return undefined;
}

function compareOptionalNumber(left: number | undefined, right: number | undefined): number {
    if (left === undefined && right === undefined) return 0;
    if (left === undefined) return 1;
    if (right === undefined) return -1;
    return left - right;
}

function compareOptionalTimestamp(left: string | null | undefined, right: string | null | undefined): number {
    const leftTime = left ? Date.parse(left) : undefined;
    const rightTime = right ? Date.parse(right) : undefined;
    return compareOptionalNumber(Number.isFinite(leftTime) ? leftTime : undefined, Number.isFinite(rightTime) ? rightTime : undefined);
}

function compareByCatalogOrder(left: SearchableCollectible, right: SearchableCollectible): number {
    const rankingCompare = compareOptionalNumber(left.ranking, right.ranking);
    if (rankingCompare !== 0) return rankingCompare;
    return left.index - right.index;
}

function compareCollectibles(left: SearchableCollectible, right: SearchableCollectible, options: CollectiblesSearchQueryOptions): number {
    switch (options.sort_type) {
        case "alphabetical":
            return left.product.name.localeCompare(right.product.name) || compareByCatalogOrder(left, right);
        case "price":
            return compareOptionalNumber(firstProductPrice(left.product), firstProductPrice(right.product)) || compareByCatalogOrder(left, right);
        case "recency":
            return compareOptionalTimestamp(left.product.unpublished_at, right.product.unpublished_at) || compareByCatalogOrder(left, right);
        case "popularity":
        case "relevance":
            return compareByCatalogOrder(left, right);
        default:
            return compareByCatalogOrder(left, right);
    }
}

function sortedCollectibles(entries: SearchableCollectible[], options: CollectiblesSearchQueryOptions): SearchableCollectible[] {
    const sorted = [...entries].sort((left, right) => compareCollectibles(left, right, options));
    if (!options.sort_type) return sorted;

    const ascendingRankSort = options.sort_type === "popularity" || options.sort_type === "relevance";
    if (ascendingRankSort) return options.sort_direction === "asc" ? sorted.reverse() : sorted;
    return options.sort_direction === "desc" ? sorted.reverse() : sorted;
}

function flattenCollectiblesCatalog(categories: readonly CollectiblesCategory[]): SearchableCollectible[] {
    const output: SearchableCollectible[] = [];

    for (const category of categories) {
        for (const product of category.products) {
            const ranking = category.hero_ranking?.indexOf(product.sku_id);
            output.push({
                category,
                product,
                index: output.length,
                ranking: ranking === undefined || ranking < 0 ? Number.MAX_SAFE_INTEGER : ranking,
            });

            for (const variant of product.variants ?? []) {
                const variantRanking = category.hero_ranking?.indexOf(variant.sku_id);
                output.push({
                    category,
                    product: variant,
                    index: output.length,
                    ranking: variantRanking === undefined || variantRanking < 0 ? Number.MAX_SAFE_INTEGER : variantRanking,
                });
            }
        }
    }

    return output;
}

export function searchCollectiblesCatalog(categories: readonly CollectiblesCategory[], options: CollectiblesSearchQueryOptions): CollectiblesSearchResponse {
    const totalFiltersWithNoLocalBacking = options.colors.length + options.themes.length + (options.orbs_eligible === undefined ? 0 : 1);
    const matchingProducts =
        totalFiltersWithNoLocalBacking > 0
            ? []
            : sortedCollectibles(
                  flattenCollectiblesCatalog(categories).filter((entry) => productTypeMatches(entry.product, options.item_types) && productTextMatches(entry, options.search)),
                  options,
              );

    const skus = matchingProducts.slice(options.offset, options.offset + options.limit).map((entry) => entry.product.sku_id);

    return {
        pagination: {
            offset: options.offset,
            limit: options.limit,
            total: matchingProducts.length,
            has_more: options.offset + options.limit < matchingProducts.length,
        },
        skus,
    };
}

export function createCollectiblesSearchRouter(catalogProvider: CollectiblesSearchCatalogProvider = getCollectiblesSearchCatalog) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Search Collectibles",
            description: "Returns locally backed collectible SKU IDs that match the requested shop search filters.",
            query: {
                item_types: {
                    type: "array",
                    description: "Collectible item types to search for.",
                },
                colors: {
                    type: "array",
                    description: "Collectible color facets to search for.",
                },
                themes: {
                    type: "array",
                    description: "Collectible theme facets to search for.",
                },
                orbs_eligible: {
                    type: "boolean",
                    description: "Whether returned products must be eligible for orb purchases.",
                },
                offset: {
                    type: "integer",
                    description: "Number of products to skip before returning results.",
                },
                limit: {
                    type: "integer",
                    description: "Maximum number of SKU IDs to return, capped at 100.",
                },
                sort_type: {
                    type: "string",
                    description: "Sort field for matching products.",
                    values: Array.from(supportedSortTypes),
                },
                sort_direction: {
                    type: "string",
                    description: "Sort direction for matching products.",
                    values: Array.from(supportedSortDirections),
                },
                search: {
                    type: "string",
                    description: "Text query to match against locally backed collectible metadata.",
                },
            },
            responses: {
                200: {
                    body: "CollectiblesSearchResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const options = parseCollectiblesSearchQuery(req.query);
            const response = searchCollectiblesCatalog(catalogProvider(options), options);

            res.status(200).json(response);
        },
    );

    return router;
}

export default createCollectiblesSearchRouter();
