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
import { ajv, nonCoercingAjv } from "../Validator";

interface JsonShape {
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
}

function readSchemas() {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonShape>;
}

test("CurrentGuildMemberResponse schema adds private guild permission strings", () => {
    const schema = readSchemas().CurrentGuildMemberResponse;

    assert.equal(schema.properties?.permissions?.type, "string");
    assert.ok(schema.required?.includes("permissions"));
});

test("CurrentGuildMemberResponse validates permission strings without numeric coercion", () => {
    const response = {
        id: "user-id",
        guild_id: "guild-id",
        roles: ["guild-id", "role-id"],
        joined_at: "2026-01-02T03:04:05.000Z",
        pending: false,
        deaf: false,
        mute: false,
        banner: "",
        bio: "",
        communication_disabled_until: null,
        flags: 0,
        permissions: "5",
        user: {
            id: "user-id",
            username: "username",
            discriminator: "0001",
            public_flags: 0,
            bio: "",
            bot: false,
            premium_type: 0,
        },
    };

    assert.equal(ajv.validate("CurrentGuildMemberResponse", response), true, JSON.stringify(ajv.errors, null, 2));
    assert.equal(nonCoercingAjv.validate("CurrentGuildMemberResponse", { ...response, permissions: 5 }), false);
});
