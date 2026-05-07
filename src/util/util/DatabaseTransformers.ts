import { ValueTransformer } from "typeorm";

export const bigintNumberTransformer: ValueTransformer = {
    to(value: number | null | undefined) {
        return value;
    },
    from(value: string | number | null | undefined) {
        if (value === null || value === undefined) return value;
        return Number(value);
    },
};
