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
import test from "node:test";
import { validateSchema } from "../Validator";

type SchemaObject = {
    properties?: Record<string, unknown>;
};

const sampleFriendSuggestionsResponse = [
    {
        suggested_user: {
            id: "852892297661906993",
            username: "alien",
            global_name: "Alien",
            avatar: "14733482e560d9267c0a414b21b2fb8d",
            discriminator: "0",
            public_flags: 64,
            avatar_decoration_data: null,
            primary_guild: null,
        },
        reasons: [
            {
                type: 1,
                platform: "contacts",
                platform_type: "contacts",
                name: "Gnarpy",
            },
        ],
        from_suggested_user_contacts: true,
    },
];

test("FriendSuggestionsResponse validates empty and documented response bodies", () => {
    assert.deepEqual(validateSchema("FriendSuggestionsResponse", []), []);

    const payload = JSON.parse(JSON.stringify(sampleFriendSuggestionsResponse)) as unknown;
    assert.deepEqual(validateSchema("FriendSuggestionsResponse", payload), sampleFriendSuggestionsResponse);
});

test("FriendSuggestionReason schema preserves documented and observed platform fields", () => {
    const schemas = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, SchemaObject>;
    const reasonSchema = schemas.FriendSuggestionReason;

    assert.ok(reasonSchema);
    assert.ok(reasonSchema.properties?.platform);
    assert.ok(reasonSchema.properties?.platform_type);
});
