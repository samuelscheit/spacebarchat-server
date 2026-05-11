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

import type { Request } from "express";
import type { StorefrontCollection, StorefrontCollectionResponse, StorefrontCollectionTenantMetadata } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors } from "@spacebar/util";
import { isStorefrontProductId, toStorefrontProductResponse, type StorefrontProductSource } from "./StorefrontProductRoute";

export interface StorefrontCollectionQueryOptions {
    country_code?: string;
    guild_id?: string;
    include_unpublished_products?: boolean;
    include_unpublished_collection?: boolean;
}

export interface StorefrontCollectionProviderOptions extends StorefrontCollectionQueryOptions {
    collection_id: string;
}

export interface StorefrontCollectionSource {
    collection: StorefrontCollection;
    products: readonly StorefrontProductSource[];
}

export type StorefrontCollectionProvider = (
    options: StorefrontCollectionProviderOptions,
) => StorefrontCollectionSource | undefined | Promise<StorefrontCollectionSource | undefined>;

export const UNKNOWN_STOREFRONT_COLLECTION_ERROR = new ApiError("Unknown Collection", 10121, 404);

export function isStorefrontCollectionId(value: string) {
    return isStorefrontProductId(value);
}

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return firstQueryValue(value[0]);
    return value;
}

function queryString(value: unknown): string | undefined {
    const entry = firstQueryValue(value);
    return typeof entry === "string" && entry.length > 0 ? entry : undefined;
}

function queryBoolean(value: unknown): boolean | undefined {
    const entry = queryString(value);
    if (entry === undefined) return undefined;
    if (entry === "true" || entry === "1") return true;
    if (entry === "false" || entry === "0") return false;
    throw DiscordApiErrors.INVALID_FORM_BODY;
}

function optionalStorefrontId(value: unknown): string | undefined {
    const entry = queryString(value);
    if (entry === undefined) return undefined;
    if (!isStorefrontCollectionId(entry)) throw DiscordApiErrors.INVALID_FORM_BODY;
    return entry;
}

export function parseStorefrontCollectionQuery(query: Request["query"]): StorefrontCollectionQueryOptions {
    return {
        country_code: queryString(query.country_code),
        guild_id: optionalStorefrontId(query.guild_id),
        include_unpublished_products: queryBoolean(query.include_unpublished_products),
        include_unpublished_collection: queryBoolean(query.include_unpublished_collection),
    };
}

export function getConfiguredStorefrontCollection(_options: StorefrontCollectionProviderOptions): StorefrontCollectionSource | undefined {
    // Spacebar does not currently persist Discord storefront collection or product catalogs.
    return undefined;
}

function cloneCollectionTenantMetadata(metadata: StorefrontCollectionTenantMetadata): StorefrontCollectionTenantMetadata {
    return { ...metadata };
}

function cloneStorefrontCollection(collection: StorefrontCollection): StorefrontCollection {
    return {
        id: collection.id,
        application_id: collection.application_id,
        name: collection.name,
        description: collection.description,
        product_ids: [...collection.product_ids],
        created_at: collection.created_at,
        updated_at: collection.updated_at,
        tenant_metadata: cloneCollectionTenantMetadata(collection.tenant_metadata),
    };
}

export function toStorefrontCollectionResponse(source: StorefrontCollectionSource): StorefrontCollectionResponse {
    const productsById = new Map(source.products.map((product) => [product.id, product]));

    return {
        collection: cloneStorefrontCollection(source.collection),
        products: source.collection.product_ids.flatMap((productId) => {
            const product = productsById.get(productId);
            return product ? [toStorefrontProductResponse(product)] : [];
        }),
    };
}

export async function getStorefrontCollection(
    collectionId: string,
    query: StorefrontCollectionQueryOptions,
    collectionProvider: StorefrontCollectionProvider = getConfiguredStorefrontCollection,
): Promise<StorefrontCollectionResponse> {
    if (!isStorefrontCollectionId(collectionId)) throw UNKNOWN_STOREFRONT_COLLECTION_ERROR;

    const source = await collectionProvider({ collection_id: collectionId, ...query });
    if (!source || source.collection.id !== collectionId) throw UNKNOWN_STOREFRONT_COLLECTION_ERROR;

    return toStorefrontCollectionResponse(source);
}
