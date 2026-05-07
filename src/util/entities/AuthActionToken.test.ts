import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getMetadataArgsStorage } from "typeorm";
import { AuthActionToken } from "./AuthActionToken";

describe("AuthActionToken entity metadata", () => {
    test("declares an explicit string column type for nullable email tokens", () => {
        const emailColumn = getMetadataArgsStorage().columns.find((column) => column.target === AuthActionToken && column.propertyName === "email");

        assert.ok(emailColumn);
        assert.equal(emailColumn.options.nullable, true);
        assert.equal(emailColumn.options.type, String);
    });
});
