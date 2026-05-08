import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { getMetadataArgsStorage } from "typeorm";
import { UserRecentAvatar } from "./UserRecentAvatar";

test("UserRecentAvatar.description keeps explicit nullable varchar metadata", () => {
    const descriptionColumn = getMetadataArgsStorage().columns.find((column) => column.target === UserRecentAvatar && column.propertyName === "description");

    assert.ok(descriptionColumn, "UserRecentAvatar.description column metadata should exist");
    assert.equal(descriptionColumn.options.type, "varchar");
    assert.equal(descriptionColumn.options.length, 1024);
    assert.equal(descriptionColumn.options.nullable, true);
});
