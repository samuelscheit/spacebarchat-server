import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ApplicationType } from "../../schemas/api/developers/Application";
import { getMetadataArgsStorage } from "typeorm";
import { Application } from "./Application";

describe("Application entity metadata", () => {
    test("stores application type as a nullable numeric enum column", () => {
        const typeColumn = getMetadataArgsStorage().columns.find((column) => column.target === Application && column.propertyName === "type");

        assert.ok(typeColumn);
        assert.equal(typeColumn.options.nullable, true);
        assert.equal(typeColumn.options.type, "int");

        const app = new Application();
        app.type = ApplicationType.GAME;

        assert.equal(app.type, 1);
    });
});
