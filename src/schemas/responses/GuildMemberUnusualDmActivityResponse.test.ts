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
import { test } from "node:test";
import { ajv } from "../Validator";

test("GuildMemberUnusualDmActivityResponse validates documented activity records", () => {
    const response = [
        {
            user_id: "934487154330066945",
            guild_id: "81384788765712384",
            unusual_dm_activity_until: "2024-01-15T06:10:37.288Z",
        },
    ];

    assert.equal(ajv.validate("GuildMemberUnusualDmActivityResponse", response), true);
    assert.equal(ajv.validate("GuildMemberUnusualDmActivityResponse", []), true);
    assert.equal(
        ajv.validate("GuildMemberUnusualDmActivityResponse", [
            {
                user_id: "934487154330066945",
                guild_id: "81384788765712384",
            },
        ]),
        false,
    );
});
