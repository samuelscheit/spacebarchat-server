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
import { join } from "node:path";
import test from "node:test";

interface JsonShape {
    $ref?: string;
    additionalProperties?: JsonShape;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string;
}

function readSchemas(): Record<string, JsonShape> {
    return JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonShape>;
}

test("ApplicationsWithAssetsResponse schema matches the documented application and asset map shape", () => {
    const schemas = readSchemas();
    const response = schemas.ApplicationsWithAssetsResponse;

    assert.equal(response.properties?.applications?.type, "array");
    assert.equal(response.properties?.applications?.items?.$ref, "#/definitions/APIApplication");
    assert.equal(response.properties?.assets?.type, "object");
    assert.equal(response.properties?.assets?.additionalProperties?.type, "array");
    assert.equal(response.properties?.assets?.additionalProperties?.items?.$ref, "#/definitions/ApplicationAssetResponse");
    assert.equal(schemas.ApplicationAssetsResponse.type, "array");
    assert.equal(schemas.ApplicationAssetsResponse.items?.$ref, "#/definitions/ApplicationAssetResponse");
    assert.deepEqual(schemas.ApplicationAssetResponse.required?.sort(), ["id", "name", "type"]);
});
