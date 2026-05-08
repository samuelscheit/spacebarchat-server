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
import Ajv from "ajv";
import addFormats from "ajv-formats";

const assetsPath = path.join(process.cwd(), "assets");
const sessionsSchemaSourcePath = path.join(process.cwd(), "src", "schemas", "api", "users", "SessionsSchemas.ts");

interface JsonShape {
    $ref?: string;
    additionalProperties?: boolean;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    type?: string;
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
const ajv = new Ajv({
    allErrors: true,
    parseDate: true,
    allowDate: true,
    schemas: JSON.parse(JSON.stringify(schemas).replaceAll("#/definitions/", "")),
    coerceTypes: true,
    messages: true,
    strict: true,
    strictRequired: true,
    allowUnionTypes: true,
});
addFormats(ajv);

function getSessionClientStatusSchema(schemas: Record<string, JsonShape>) {
    const response = schemas.GetSessionsResponse;
    const deviceInfo = response.properties?.user_sessions?.items;
    const clientStatus = deviceInfo?.properties?.client_status;

    assert.equal(clientStatus?.$ref, "#/definitions/SessionClientStatus");
    return schemas.SessionClientStatus;
}

test("SessionsSchemas source stays decoupled from util entity exports", () => {
    const source = fs.readFileSync(sessionsSchemaSourcePath, "utf8");

    assert.equal(source.includes("@spacebar/util"), false);
});

test("GetSessionsResponse schema owns its session client status DTO", () => {
    const sessionClientStatus = getSessionClientStatusSchema(schemas);

    assert.deepEqual(Object.keys(sessionClientStatus.properties ?? {}).toSorted(), ["desktop", "embedded", "mobile", "vr", "web"]);
    assert.equal(sessionClientStatus.additionalProperties, false);
});

test("GetSessionsResponse OpenAPI schema uses the session client status DTO", () => {
    const openapi = readAssetJson<{
        components: { schemas: Record<string, JsonShape> };
    }>("openapi.json");
    const response = openapi.components.schemas.GetSessionsResponse;
    const deviceInfo = response.properties?.user_sessions?.items;

    assert.equal(deviceInfo?.properties?.client_status?.$ref, "#/components/schemas/SessionClientStatus");
});

test("GetSessionsResponse validates extended session payloads with session client status", () => {
    assert.equal(
        ajv.validate("GetSessionsResponse", {
            user_sessions: [
                {
                    id: "session-id",
                    id_hash: "hash",
                    status: "online",
                    activities: [],
                    client_status: { desktop: "online", web: "idle" },
                    approx_last_used_time: "2026-05-08T00:00:00.000Z",
                    client_info: {
                        client: "desktop",
                        os: "Linux",
                        version: 1,
                        location: "Earth",
                    },
                    last_seen: "2026-05-08T00:00:00.000Z",
                    last_seen_ip: "127.0.0.1",
                    last_seen_location: "Earth",
                },
            ],
        }),
        true,
    );
});
