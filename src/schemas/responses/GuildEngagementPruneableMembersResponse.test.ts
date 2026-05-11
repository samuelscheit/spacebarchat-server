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

test("GuildEngagementPruneableMembersResponse validates documented inactive member buckets", () => {
    const response = [
        {
            day_pt: "2026-05-01T00:00:00Z",
            inactive: 7,
        },
    ];

    assert.equal(ajv.validate("GuildEngagementPruneableMembersResponse", response), true);
    assert.equal(ajv.validate("GuildEngagementPruneableMembersResponse", []), true);
    assert.equal(
        ajv.validate("GuildEngagementPruneableMembersResponse", [
            {
                day_pt: "2026-05-01T00:00:00Z",
            },
        ]),
        false,
    );
});
