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

type JsonShape = {
    $ref?: string;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
    [key: string]: unknown;
};

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", name), "utf8")) as T;
}

test("LinkedConnectionsResponse schema matches the OAuth linked-connection envelope", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const response = schemas.LinkedConnectionsResponse;
    const connection = schemas.LinkedConnectionResponse;

    assert.equal(response.type, "array");
    assert.equal(response.items?.$ref, "#/definitions/LinkedConnectionResponse");
    assert.deepEqual(Object.keys(connection.properties ?? {}).sort(), [
        "friend_sync",
        "id",
        "metadata",
        "metadata_visibility",
        "name",
        "revoked",
        "show_activity",
        "two_way_link",
        "type",
        "verified",
        "visibility",
    ]);
    assert.equal(connection.properties?.access_token, undefined);
    assert.equal(connection.properties?.integrations, undefined);
    assert.equal(connection.properties?.user_id, undefined);
    assert.deepEqual(connection.required?.sort(), [
        "friend_sync",
        "id",
        "metadata_visibility",
        "name",
        "revoked",
        "show_activity",
        "two_way_link",
        "type",
        "verified",
        "visibility",
    ]);
});
