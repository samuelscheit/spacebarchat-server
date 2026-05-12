/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTIBILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

type JsonShape = {
    $ref?: string;
    additionalProperties?: boolean | JsonShape;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
    [key: string]: unknown;
};

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", name), "utf8")) as T;
}

function resolveSchema(schemas: Record<string, JsonShape>, schema: JsonShape | undefined): JsonShape {
    if (!schema) return {};

    let current = schema;
    while (current.$ref) {
        const name = current.$ref.replace("#/definitions/", "").replace("#/components/schemas/", "");
        current = schemas[name];
    }

    return current;
}

test("ApplicationRoleConnectionsResponse schema matches the documented role connection list", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const response = schemas.ApplicationRoleConnectionsResponse;
    const roleConnection = schemas.ApplicationRoleConnectionResponse;
    const metadata = schemas.ApplicationRoleConnectionMetadataResponse;
    const metadataValues = resolveSchema(schemas, roleConnection.properties?.metadata);
    const nameLocalizations = resolveSchema(schemas, metadata.properties?.name_localizations);

    assert.equal(response.type, "array");
    assert.equal(response.items?.$ref, "#/definitions/ApplicationRoleConnectionResponse");
    assert.deepEqual(roleConnection.properties?.platform_name?.type, ["null", "string"]);
    assert.deepEqual(roleConnection.properties?.platform_username?.type, ["null", "string"]);
    assert.equal(metadataValues.additionalProperties && typeof metadataValues.additionalProperties !== "boolean" ? metadataValues.additionalProperties.type : undefined, "string");
    assert.equal(roleConnection.properties?.application_metadata?.items?.$ref, "#/definitions/ApplicationRoleConnectionMetadataResponse");
    assert.deepEqual(roleConnection.required?.sort(), ["metadata", "platform_name", "platform_username"]);

    assert.deepEqual(metadata.required?.sort(), ["description", "key", "name", "type"]);
    assert.equal(metadata.properties?.key?.type, "string");
    assert.equal(metadata.properties?.type?.type, "integer");
    assert.equal(
        nameLocalizations.additionalProperties && typeof nameLocalizations.additionalProperties !== "boolean" ? nameLocalizations.additionalProperties.type : undefined,
        "string",
    );
});
