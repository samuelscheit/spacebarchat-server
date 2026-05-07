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
import { serializeThreadSearchMember } from "./ThreadSearch";

test("thread search member serialization exposes the public member shape", () => {
    const serialized = serializeThreadSearchMember(
        {
            id: "100",
            index: "1",
            member_idx: "2",
            join_timestamp: new Date("2026-01-02T03:04:05.000Z"),
            flags: 0,
            muted: false,
        } as Parameters<typeof serializeThreadSearchMember>[0],
        "200",
    );

    assert.deepEqual(serialized, {
        id: "100",
        user_id: "200",
        join_timestamp: "2026-01-02T03:04:05.000Z",
        flags: 0,
        muted: false,
        mute_config: undefined,
    });
    assert.equal("index" in serialized, false);
    assert.equal("member_idx" in serialized, false);
});

test("thread search member serialization preserves persisted JSON mute end times", () => {
    const serialized = serializeThreadSearchMember(
        {
            id: "100",
            join_timestamp: new Date("2026-01-02T03:04:05.000Z"),
            flags: 0,
            muted: true,
            mute_config: {
                end_time: "2026-02-03T04:05:06.000Z",
                selected_time_window: 3600,
            },
        },
        "200",
    );

    assert.deepEqual(serialized.mute_config, {
        end_time: "2026-02-03T04:05:06.000Z",
        selected_time_window: 3600,
    });
});

test("thread search member serialization converts Date mute end times", () => {
    const serialized = serializeThreadSearchMember(
        {
            id: "100",
            join_timestamp: new Date("2026-01-02T03:04:05.000Z"),
            flags: 0,
            muted: true,
            mute_config: {
                end_time: new Date("2026-02-03T04:05:06.000Z"),
            },
        },
        "200",
    );

    assert.equal(serialized.mute_config?.end_time, "2026-02-03T04:05:06.000Z");
});
