import type { Request } from "express";
import { FindOperator, In } from "typeorm";

type QueryValue = Request["query"][string];
const MAX_POSTGRES_INTEGER = 2147483647;

export function parseDiscoverableGuildCategoryIds(categories: QueryValue): number[] {
    const values = Array.isArray(categories) ? categories : [categories];
    const categoryIds = new Set<number>();

    for (const value of values) {
        if (typeof value !== "string") continue;

        for (const categoryId of value.split(",")) {
            const trimmed = categoryId.trim();
            if (!/^\d+$/.test(trimmed)) continue;

            const parsed = Number(trimmed);
            if (Number.isSafeInteger(parsed) && parsed <= MAX_POSTGRES_INTEGER) categoryIds.add(parsed);
        }
    }

    return [...categoryIds];
}

export function createDiscoverableGuildCategoryFilter(categories: QueryValue): number | FindOperator<number> | undefined {
    const categoryIds = parseDiscoverableGuildCategoryIds(categories);
    if (!categoryIds.length) return undefined;
    if (categoryIds.length === 1) return categoryIds[0];
    return In(categoryIds);
}
