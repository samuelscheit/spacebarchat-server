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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

type SchemaProperty = {
    $ref?: string;
    type?: string;
};

type ArraySchemaProperty = SchemaProperty & {
    items?: Schema;
};

type Schema = {
    properties?: Record<string, SchemaProperty | ArraySchemaProperty>;
    required?: string[];
};

type SchemaMap = Record<string, Schema>;

type OpenApiDocument = {
    components?: {
        schemas?: SchemaMap;
    };
};

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(path.resolve(process.cwd(), file), "utf8")) as T;
}

function assertPublicTokenSettings(schemaMap: SchemaMap, settingsRef: string) {
    assert.equal(schemaMap.TokenResponse.properties?.settings?.$ref, settingsRef);
    assert.ok(schemaMap.UserSettingsSchema);
    assert.equal("index" in (schemaMap.UserSettingsSchema.properties ?? {}), false);
    assert.equal(schemaMap.UserSettingsSchema.required?.includes("index"), false);
}

function assertPublicBackupCodes(schemaMap: SchemaMap) {
    const backupCodes = schemaMap.TokenWithBackupCodesResponse.properties?.backup_codes as ArraySchemaProperty | undefined;
    const properties = backupCodes?.items?.properties ?? {};

    assert.deepEqual(Object.keys(properties), ["id", "code", "consumed"]);
    assert.equal(properties.id.type, "string");
    assert.equal(properties.code.type, "string");
    assert.equal(properties.consumed.type, "boolean");
}

describe("TokenResponse schema", () => {
    test("uses schema-layer response types instead of util entities", () => {
        const schemas = readJson<SchemaMap>("assets/schemas.json");

        assertPublicTokenSettings(schemas, "#/definitions/UserSettingsSchema");
        assertPublicBackupCodes(schemas);
    });

    test("publishes the same public token response shapes through OpenAPI", () => {
        const openapi = readJson<OpenApiDocument>("assets/openapi.json");
        const schemas = openapi.components?.schemas ?? {};

        assertPublicTokenSettings(schemas, "#/components/schemas/UserSettingsSchema");
        assertPublicBackupCodes(schemas);
    });
});
