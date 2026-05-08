import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { EntityMetadata } from "typeorm";
import * as Database from "../util/Database";
import { BaseClassWithoutId } from "./BaseClass";

const originalGetDatabase = Database.getDatabase;

afterEach(() => {
    Object.defineProperty(Database, "getDatabase", {
        configurable: true,
        value: originalGetDatabase,
    });
});

test("BaseClassWithoutId.toJSON serializes TypeORM column and relation metadata without lint suppressions", () => {
    class SerializedEntity extends BaseClassWithoutId {
        columnValue = "column";
        relationValue = { id: "relation" };
        ignoredValue = "ignored";
    }

    const metadata = {
        columns: [{ propertyName: "columnValue" }],
        relations: [{ propertyName: "relationValue" }],
    } as EntityMetadata;

    Object.defineProperty(Database, "getDatabase", {
        configurable: true,
        value: () => ({
            getMetadata(target: typeof SerializedEntity) {
                assert.equal(target, SerializedEntity);
                return metadata;
            },
        }),
    });

    const entity = new SerializedEntity();

    assert.deepEqual(entity.toJSON(), {
        columnValue: "column",
        relationValue: { id: "relation" },
    });
});
