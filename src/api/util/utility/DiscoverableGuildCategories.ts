import type { Request } from "express";
import { FindOperator, In } from "typeorm";

type QueryValue = Request["query"][string];

export function parseDiscoverableGuildCategoryIds(categories: QueryValue): string[] {
    const values = Array.isArray(categories) ? categories : [categories];
    const categoryIds = new Set<string>();

    for (const value of values) {
        if (typeof value !== "string") continue;

        for (const categoryId of value.split(",")) {
            const trimmed = categoryId.trim();
            if (trimmed) categoryIds.add(trimmed);
        }
    }

    return [...categoryIds];
}

export function createDiscoverableGuildCategoryFilter(categories: QueryValue): string | FindOperator<string> | undefined {
    const categoryIds = parseDiscoverableGuildCategoryIds(categories);
    if (!categoryIds.length) return undefined;
    if (categoryIds.length === 1) return categoryIds[0];
    return In(categoryIds);
}
