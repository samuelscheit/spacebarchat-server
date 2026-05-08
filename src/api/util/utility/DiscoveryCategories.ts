import type { Request } from "express";
import type { FindManyOptions } from "typeorm";
import type { Categories } from "@spacebar/util";

type QueryValue = Request["query"][string];

export function parseDiscoveryPrimaryOnly(primaryOnly: QueryValue): boolean {
    if (Array.isArray(primaryOnly)) return primaryOnly.some(parseDiscoveryPrimaryOnly);
    if (typeof primaryOnly !== "string") return false;

    return ["1", "true"].includes(primaryOnly.trim().toLowerCase());
}

export function createDiscoveryCategoryFindOptions(primaryOnly: QueryValue): FindManyOptions<Categories> {
    return {
        order: { id: "ASC" },
        ...(parseDiscoveryPrimaryOnly(primaryOnly) ? { where: { is_primary: true } } : {}),
    };
}
