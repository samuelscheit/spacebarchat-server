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
import { ajv } from "../Validator";

describe("CheckpointResponse schema", () => {
    test("validates a backed Spacebar checkpoint response without fabricated Discord-only stats", () => {
        const response = {
            avatar_decoration: null,
            messages: {
                num_messages_sent: 42,
                num_messages_sent_percentile: null,
                top_month: null,
            },
            guilds: {
                num_guilds_joined: 3,
                guilds: [],
            },
            users: [],
        };

        assert.equal(ajv.validate("CheckpointResponse", response), true);
        assert.equal(ajv.validate("CheckpointResponse", { ...response, internal_field: true }), false);
    });

    test("accepts Discord checkpoint float fields as JSON numbers", () => {
        assert.equal(
            ajv.validate("CheckpointResponse", {
                avatar_decoration: null,
                power_level: 83732.32311666667,
                power_level_percentile: 87.039,
                voice: {
                    total_voice_minutes: 6.3231166666666665,
                    total_voice_minutes_percentile: null,
                    top_month: {
                        month: 7,
                        num_minutes_in_voice: 6.23785,
                    },
                },
                emojis: {
                    num_emojis_sent: 1,
                    emojis: [{ name: "" }],
                },
            }),
            true,
        );
    });
});
