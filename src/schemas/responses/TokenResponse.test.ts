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
};

type Schema = {
    properties?: Record<string, SchemaProperty>;
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

describe("TokenResponse schema", () => {
    test("uses public user settings in generated validation schemas", () => {
        const schemas = readJson<SchemaMap>("assets/schemas.json");

        assert.equal(schemas.TokenResponse.properties?.settings?.$ref, "#/definitions/UserSettingsSchema");
        assert.equal("index" in (schemas.UserSettingsSchema.properties ?? {}), false);
        assert.equal(schemas.UserSettingsSchema.required?.includes("index"), false);
    });

    test("uses public user settings in generated OpenAPI schemas", () => {
        const openapi = readJson<OpenApiDocument>("assets/openapi.json");
        const schemas = openapi.components?.schemas ?? {};

        assert.equal(schemas.TokenResponse.properties?.settings?.$ref, "#/components/schemas/UserSettingsSchema");
        assert.equal("index" in (schemas.UserSettingsSchema.properties ?? {}), false);
        assert.equal(schemas.UserSettingsSchema.required?.includes("index"), false);
    });
});
