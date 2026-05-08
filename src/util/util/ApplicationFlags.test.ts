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
import { ApplicationFlags } from "./ApplicationFlags";

test("ApplicationFlags match known Discord application flag bits", () => {
    assert.deepEqual(Object.fromEntries(Object.entries(ApplicationFlags.FLAGS).map(([name, value]) => [name, Number(value)])), {
        EMBEDDED_RELEASED: 1 << 1,
        MANAGED_EMOJI: 1 << 2,
        EMBEDDED_IAP: 1 << 3,
        GROUP_DM_CREATE: 1 << 4,
        APPLICATION_AUTO_MODERATION_RULE_CREATE_BADGE: 1 << 6,
        RPC_HAS_CONNECTED: 1 << 11,
        GATEWAY_PRESENCE: 1 << 12,
        GATEWAY_PRESENCE_LIMITED: 1 << 13,
        GATEWAY_GUILD_MEMBERS: 1 << 14,
        GATEWAY_GUILD_MEMBERS_LIMITED: 1 << 15,
        VERIFICATION_PENDING_GUILD_LIMIT: 1 << 16,
        EMBEDDED: 1 << 17,
        GATEWAY_MESSAGE_CONTENT: 1 << 18,
        GATEWAY_MESSAGE_CONTENT_LIMITED: 1 << 19,
        EMBEDDED_FIRST_PARTY: 1 << 20,
        APPLICATION_COMMAND_BADGE: 1 << 23,
    });
});

test("ApplicationFlags support named bitfield operations while preserving unknown numeric bits", () => {
    const unknownFutureFlag = 1n << 30n;
    const flags = new ApplicationFlags(["GATEWAY_PRESENCE", unknownFutureFlag]);

    assert.equal(flags.has("GATEWAY_PRESENCE"), true);
    assert.equal(flags.has("GATEWAY_GUILD_MEMBERS"), false);
    assert.equal(flags.has(unknownFutureFlag), true);

    flags.add("GATEWAY_GUILD_MEMBERS");
    assert.equal(flags.has(["GATEWAY_PRESENCE", "GATEWAY_GUILD_MEMBERS"]), true);

    flags.remove("GATEWAY_PRESENCE");
    assert.equal(flags.has("GATEWAY_PRESENCE"), false);
    assert.equal(flags.has(unknownFutureFlag), true);
});
