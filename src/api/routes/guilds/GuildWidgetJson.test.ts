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

test("guild widget JSON skips invite lookup when widget_channel_id is null", async (t) => {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";
    const util = require("../../../util") as typeof import("../../../util");

    let inviteFindCalls = 0;
    let inviteCreateCalls = 0;

    t.mock.method(util.Guild, "findOneOrFail", async () => ({
        id: "guild",
        channel_ordering: [],
        widget_channel_id: null,
        widget_enabled: true,
        presence_count: 0,
        name: "Widget Guild",
    }));
    t.mock.method(util.Invite, "findOne", async () => {
        inviteFindCalls += 1;
        return null;
    });
    t.mock.method(util.Invite, "createForChannel", () => {
        inviteCreateCalls += 1;
        return {
            save: async () => ({ code: "invite" }),
        };
    });
    t.mock.method(util.Channel, "getOrderedChannels", async () => []);
    t.mock.method(util.Member, "find", async () => []);

    const { getWidgetJsonData } = require("./#guild_id/widget.json") as typeof import("./#guild_id/widget.json");
    const data = await getWidgetJsonData("guild");

    assert.equal(data.instant_invite, null);
    assert.equal(inviteFindCalls, 0);
    assert.equal(inviteCreateCalls, 0);
});
