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

describe("UserApplicationIdentitiesResponse", () => {
    test("accepts empty and profiled application identity responses", () => {
        assert.equal(ajv.validate("UserApplicationIdentitiesResponse", { identities: [] }), true, JSON.stringify(ajv.errors));
        assert.equal(
            ajv.validate("UserApplicationIdentitiesResponse", {
                identities: [
                    {
                        application_id: "100000000000000001",
                        provider_issued_user_id: "external-user",
                        profile: {
                            username: "external-name",
                            metadata: null,
                            connection_visible: true,
                            data_trusted: false,
                            data: {
                                primary: {
                                    season: "Season 5.0",
                                    rank_name: "No Season Data",
                                    playtime_hours: 2.29,
                                    total_wins: 12,
                                    featured_played_character_image: {
                                        url: "https://example.invalid/character.png",
                                    },
                                },
                            },
                        },
                    },
                ],
            }),
            true,
            JSON.stringify(ajv.errors),
        );
    });

    test("rejects non-object user application identity responses", () => {
        assert.equal(ajv.validate("UserApplicationIdentitiesResponse", []), false);
        assert.equal(ajv.validate("UserApplicationIdentitiesResponse", { identities: [{ provider_issued_user_id: "external-user" }] }), false);
    });
});
