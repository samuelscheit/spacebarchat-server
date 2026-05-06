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

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { shouldIncrementMentionCount } from "./MessageNotifications";

describe("message notification side effects", () => {
    test("increments mention counts for new messages by default", () => {
        assert.equal(shouldIncrementMentionCount(), true);
        assert.equal(shouldIncrementMentionCount({}), true);
        assert.equal(shouldIncrementMentionCount({ suppress_notifications: false }), true);
    });

    test("does not increment mention counts when notifications are suppressed", () => {
        assert.equal(shouldIncrementMentionCount({ suppress_notifications: true }), false);
    });
});
