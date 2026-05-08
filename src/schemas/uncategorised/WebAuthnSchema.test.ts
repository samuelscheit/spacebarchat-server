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
    anyOf?: JsonShape[];
    additionalProperties?: boolean;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

test("WebAuthnPostSchema uses purpose-specific registration schema names", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");

    assert.equal(schemas.GenerateWebAuthnCredentialsSchema, undefined);
    assert.equal(schemas.CreateWebAuthnCredentialSchema, undefined);
    assert.deepEqual(schemas.WebAuthnPostSchema.anyOf, [
        { $ref: "#/definitions/WebAuthnCredentialRegistrationChallengeSchema" },
        { $ref: "#/definitions/WebAuthnCredentialRegistrationCompletionSchema" },
    ]);
    assert.deepEqual(schemas.WebAuthnCredentialRegistrationChallengeSchema, {
        type: "object",
        properties: {
            password: {
                type: "string",
            },
        },
        additionalProperties: false,
        required: ["password"],
        $schema: "http://json-schema.org/draft-07/schema#",
    });
    assert.deepEqual(schemas.WebAuthnCredentialRegistrationCompletionSchema, {
        type: "object",
        properties: {
            credential: {
                type: "string",
            },
            name: {
                type: "string",
            },
            ticket: {
                type: "string",
            },
        },
        additionalProperties: false,
        required: ["credential", "name", "ticket"],
        $schema: "http://json-schema.org/draft-07/schema#",
    });
});

test("WebAuthnPostSchema OpenAPI references purpose-specific registration schema names", () => {
    const openapi = readAssetJson<{ components: { schemas: Record<string, JsonShape> } }>("openapi.json");

    assert.equal(openapi.components.schemas.GenerateWebAuthnCredentialsSchema, undefined);
    assert.equal(openapi.components.schemas.CreateWebAuthnCredentialSchema, undefined);
    assert.deepEqual(openapi.components.schemas.WebAuthnPostSchema.anyOf, [
        { $ref: "#/components/schemas/WebAuthnCredentialRegistrationChallengeSchema" },
        { $ref: "#/components/schemas/WebAuthnCredentialRegistrationCompletionSchema" },
    ]);
});
