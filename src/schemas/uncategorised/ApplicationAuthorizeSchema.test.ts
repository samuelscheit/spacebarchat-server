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
import { ajv } from "../Validator";

const assetsPath = path.join(process.cwd(), "assets");

interface JsonShape {
    minLength?: number;
    properties?: Record<string, JsonShape>;
    type?: string | string[];
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

test("ApplicationAuthorizeSchema requires a non-empty guild_id", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");

    assert.deepEqual(schemas.ApplicationAuthorizeSchema.properties?.guild_id, {
        minLength: 1,
        type: "string",
    });
});

test("ApplicationAuthorizeSchema rejects empty guild_id values", () => {
    const validBody = {
        authorize: true,
        guild_id: "123456789012345678",
        permissions: "0",
    };

    assert.equal(ajv.validate("ApplicationAuthorizeSchema", validBody), true);
    assert.equal(ajv.validate("ApplicationAuthorizeSchema", { ...validBody, guild_id: "" }), false);
});
