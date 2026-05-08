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
import test from "node:test";
import { serializeOAuthAuthorizeApplication } from "./OAuthAuthorize";

function createApplication(guild_id?: string | null) {
    return {
        id: "app-id",
        name: "Test App",
        icon: "icon-hash",
        description: "description",
        summary: "summary",
        type: null,
        hook: true,
        guild_id,
        bot_public: true,
        bot_require_code_grant: false,
        verify_key: "verify-key",
        flags: 0,
    };
}

test("serializeOAuthAuthorizeApplication includes linked guild_id", () => {
    const serialized = serializeOAuthAuthorizeApplication(createApplication("guild-id"));

    assert.equal(serialized.guild_id, "guild-id");
});

test("serializeOAuthAuthorizeApplication returns null for unlinked applications", () => {
    const serialized = serializeOAuthAuthorizeApplication(createApplication(undefined));

    assert.equal(serialized.guild_id, null);
});
