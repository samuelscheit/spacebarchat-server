/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

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
    $ref?: string;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

test("UserProfileResponse schema matches route-owned profile fields", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const response = schemas.UserProfileResponse;

    assert.equal(response.properties?.connected_accounts?.type, "array");
    assert.equal(response.properties?.connected_accounts?.items?.$ref, "#/definitions/PartialConnectedAccountResponse");
    assert.notEqual(response.properties?.connected_accounts?.$ref, "#/definitions/PublicConnectedAccount");
    assert.equal(response.required?.includes("mutual_guilds"), false);
    assert.equal(response.properties?.mutual_friends?.type, "array");
    assert.equal(response.properties?.mutual_friends_count?.type, "integer");
    assert.equal(schemas.ProfileBadge.properties?.link?.type, "string");
    assert.deepEqual(schemas.UserProfile.properties?.bio?.type, ["null", "string"]);
});

test("UserProfileResponse validates visible connected accounts and optional query fields", () => {
    const response = {
        connected_accounts: [
            {
                id: "connection-1",
                type: "github",
                name: "alice",
                verified: true,
                metadata: { verified_at: "2026-05-06T00:00:00.000Z" },
            },
        ],
        premium_since: null,
        user: {
            id: "100",
            username: "alice",
            discriminator: "0001",
            public_flags: 0,
            bot: false,
            bio: "",
            premium_since: null,
            premium_type: 0,
        },
        premium_type: 0,
        profile_themes_experiment_bucket: 4,
        user_profile: {
            bio: null,
            accent_color: null,
            banner: null,
            pronouns: null,
            theme_colors: null,
        },
        badges: [
            {
                id: "early_supporter",
                description: "Early Supporter",
                icon: "supporter",
            },
        ],
    };

    assert.equal(ajv.validate("UserProfileResponse", response), true);
    assert.equal(ajv.validate("UserProfileResponse", { ...response, connected_accounts: response.connected_accounts[0] }), false);
    assert.equal(ajv.validate("UserProfileResponse", { ...response, connected_accounts: [{ ...response.connected_accounts[0], metadata: null }] }), false);
    assert.equal(ajv.validate("UserProfileResponse", { ...response, guild_member: { user: response.user } }), false);
});
