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
    additionalProperties?: JsonShape | boolean;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string;
}

function readSchemas(): Record<string, JsonShape> {
    return JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonShape>;
}

test("ApplicationCommandIndexResponse schema matches the documented command index shape", () => {
    const schemas = readSchemas();
    const response = schemas.ApplicationCommandIndexResponse;

    assert.equal(response.properties?.applications?.type, "array");
    assert.equal(response.properties?.applications?.items?.$ref, "#/definitions/ApplicationCommandIndexApplicationResponse");
    assert.equal(response.properties?.application_commands?.type, "array");
    assert.equal(response.properties?.application_commands?.items?.$ref, "#/definitions/ApplicationCommandSchema");
    assert.equal(response.properties?.version?.type, "string");
    assert.deepEqual(response.required?.sort(), ["application_commands", "applications", "version"]);

    const application = schemas.ApplicationCommandIndexApplicationResponse;
    assert.equal(application.properties?.id?.type, "string");
    assert.equal(application.properties?.flags?.type, "integer");
    assert.equal(application.properties?.bot?.$ref, "#/definitions/ApplicationCommandIndexBotResponse");
    assert.equal(application.properties?.bot_id?.type, "string");
    assert.equal(application.properties?.permissions?.$ref, "#/definitions/ApplicationCommandIndexPermissions");
    assert.equal(application.properties?.embedded_activity_config?.$ref, "#/definitions/ApplicationCommandIndexEmbeddedActivityConfigResponse");
});
