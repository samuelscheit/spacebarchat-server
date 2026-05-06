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
import { ajv } from "../../Validator";

const assetsPath = path.join(process.cwd(), "assets");

interface JsonShape {
    anyOf?: JsonShape[];
    $ref?: string;
    enum?: unknown[];
    items?: JsonShape;
    minItems?: number;
    pattern?: string;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
    uniqueItems?: boolean;
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

test("ApplicationModifySchema exposes install params validation", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");

    assert.deepEqual(schemas.ApplicationModifySchema.properties?.install_params?.anyOf, [{ $ref: "#/definitions/ApplicationInstallParams" }, { type: "null" }]);
    assert.deepEqual(schemas.ApplicationInstallParams.required, ["permissions", "scopes"]);
    assert.equal(schemas.ApplicationInstallParams.properties?.permissions?.type, "string");
    assert.equal(schemas.ApplicationInstallParams.properties?.permissions?.pattern, "^(?:0|[1-9][0-9]*)$");
    assert.deepEqual(schemas.ApplicationInstallParams.properties?.scopes, {
        type: "array",
        items: {
            enum: ["applications.commands", "bot"],
            type: "string",
        },
        minItems: 1,
        uniqueItems: true,
    });
});

test("ApplicationModifySchema validates install params", () => {
    assert.equal(
        ajv.validate("ApplicationModifySchema", {
            install_params: {
                scopes: ["bot", "applications.commands"],
                permissions: "0",
            },
        }),
        true,
    );

    assert.equal(
        ajv.validate("ApplicationModifySchema", {
            install_params: null,
        }),
        true,
    );

    assert.equal(
        ajv.validate("ApplicationModifySchema", {
            install_params: {
                scopes: ["bot"],
            },
        }),
        false,
    );

    assert.equal(
        ajv.validate("ApplicationModifySchema", {
            install_params: {
                scopes: [],
                permissions: "0",
            },
        }),
        false,
    );

    assert.equal(
        ajv.validate("ApplicationModifySchema", {
            install_params: {
                scopes: ["bot", "bot"],
                permissions: "0",
            },
        }),
        false,
    );

    assert.equal(
        ajv.validate("ApplicationModifySchema", {
            install_params: {
                scopes: ["identify"],
                permissions: "0",
            },
        }),
        false,
    );

    assert.equal(
        ajv.validate("ApplicationModifySchema", {
            install_params: {
                scopes: ["bot"],
                permissions: "not-a-permission-bitset",
            },
        }),
        false,
    );

    assert.equal(
        ajv.validate("ApplicationModifySchema", {
            install_params: {
                scopes: ["bot"],
                permissions: "0",
                extra: true,
            },
        }),
        false,
    );
});
