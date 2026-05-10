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
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const assetsPath = path.join(process.cwd(), "assets");

interface JsonShape {
    $ref?: string;
    additionalProperties?: JsonShape;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
    [key: string]: unknown;
}

interface OpenApiOperation {
    responses?: Record<string, { content?: Record<string, { schema?: JsonShape }> }>;
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

test("ChannelLinkedAccountsResponse schema matches the Userdoccers linked account map", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const response = schemas.ChannelLinkedAccountsResponse;
    const linkedAccounts = response.properties?.linked_accounts;

    assert.equal(linkedAccounts?.type, "object");
    assert.equal(linkedAccounts?.additionalProperties?.type, "array");
    assert.equal(linkedAccounts?.additionalProperties?.items?.$ref, "#/definitions/ChannelLinkedAccount");
    assert.deepEqual(schemas.ChannelLinkedAccount.required?.sort(), ["id", "name"]);
    assert.deepEqual(Object.keys(schemas.ChannelLinkedAccount.properties ?? {}).sort(), ["id", "name"]);
});

test("OpenAPI documents GET /channels/{channel_id}/linked-accounts with the linked accounts response", () => {
    const openapi = readAssetJson<{ paths: Record<string, { get?: OpenApiOperation }> }>("openapi.json");
    const operation = openapi.paths["/channels/{channel_id}/linked-accounts/"].get;
    const schema = operation?.responses?.["200"]?.content?.["application/json"]?.schema;

    assert.equal(schema?.$ref, "#/components/schemas/ChannelLinkedAccountsResponse");
});
