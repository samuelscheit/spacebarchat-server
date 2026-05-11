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
import { test } from "node:test";

const schemas = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf8"));
const openapi = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf8"));

test("lobby response schema describes the documented lobby object", () => {
    const schema = schemas.LobbyResponse;

    assert.equal(schema.type, "object");
    assert.equal(schema.properties.id.type, "string");
    assert.equal(schema.properties.application_id.type, "string");
    assert.deepEqual(schema.properties.metadata.anyOf, [{ $ref: "#/definitions/LobbyMetadata" }, { type: "null" }]);
    assert.equal(schema.properties.members.type, "array");
    assert.equal(schema.properties.members.items.$ref, "#/definitions/LobbyMemberResponse");
    assert.equal(schema.properties.flags.type, "integer");
    assert.equal(schema.properties.linked_channel.$ref, "#/definitions/PublicChannel");
    assert.equal(schemas.LobbyMetadata.additionalProperties.type, "string");
});

test("lobby member response schema documents member metadata and transient connected state", () => {
    const schema = schemas.LobbyMemberResponse;

    assert.equal(schema.type, "object");
    assert.equal(schema.properties.id.type, "string");
    assert.deepEqual(schema.properties.metadata.anyOf, [{ $ref: "#/definitions/LobbyMetadata" }, { type: "null" }]);
    assert.equal(schema.properties.flags.type, "integer");
    assert.equal(schema.properties.connected.type, "boolean");
});

test("lobby GET route OpenAPI response uses LobbyResponse", () => {
    assert.equal(openapi.paths["/lobbies/{lobby_id}/"].get.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/LobbyResponse");
});
