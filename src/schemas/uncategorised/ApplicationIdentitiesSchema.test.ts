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
import { describe, test } from "node:test";
import { ajv, nonCoercingAjv } from "../Validator";

describe("ApplicationIdentitiesSchema", () => {
    test("accepts 1 to 100 requested user ids", () => {
        assert.equal(ajv.validate("ApplicationIdentitiesSchema", { user_ids: ["123"] }), true, JSON.stringify(ajv.errors));
        assert.equal(
            ajv.validate("ApplicationIdentitiesSchema", {
                user_ids: Array.from({ length: 100 }, (_, index) => String(index + 1)),
            }),
            true,
            JSON.stringify(ajv.errors),
        );
    });

    test("rejects missing, empty, oversized, and non-string user ids", () => {
        assert.equal(ajv.validate("ApplicationIdentitiesSchema", {}), false);
        assert.equal(ajv.validate("ApplicationIdentitiesSchema", { user_ids: [] }), false);
        assert.equal(
            ajv.validate("ApplicationIdentitiesSchema", {
                user_ids: Array.from({ length: 101 }, (_, index) => String(index + 1)),
            }),
            false,
        );
        assert.equal(nonCoercingAjv.validate("ApplicationIdentitiesSchema", { user_ids: [123] }), false);
    });
});
