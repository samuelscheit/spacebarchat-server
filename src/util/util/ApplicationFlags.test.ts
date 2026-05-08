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

const documentedDiscordFlags = {
    APPLICATION_AUTO_MODERATION_RULE_CREATE_BADGE: 1n << 6n,
    GATEWAY_PRESENCE: 1n << 12n,
    GATEWAY_PRESENCE_LIMITED: 1n << 13n,
    GATEWAY_GUILD_MEMBERS: 1n << 14n,
    GATEWAY_GUILD_MEMBERS_LIMITED: 1n << 15n,
    VERIFICATION_PENDING_GUILD_LIMIT: 1n << 16n,
    EMBEDDED: 1n << 17n,
    GATEWAY_MESSAGE_CONTENT: 1n << 18n,
    GATEWAY_MESSAGE_CONTENT_LIMITED: 1n << 19n,
    APPLICATION_COMMAND_BADGE: 1n << 23n,
};

// These flags are not all present in Discord's public Application Flags table,
// but discord-api-types tracks their known wire values.
const knownDiscordApiTypeFlags = {
    EMBEDDED_RELEASED: 1n << 1n,
    MANAGED_EMOJI: 1n << 2n,
    EMBEDDED_IAP: 1n << 3n,
    GROUP_DM_CREATE: 1n << 4n,
    RPC_HAS_CONNECTED: 1n << 11n,
    EMBEDDED_FIRST_PARTY: 1n << 20n,
};

const expectedApplicationFlags = {
    EMBEDDED_RELEASED: knownDiscordApiTypeFlags.EMBEDDED_RELEASED,
    MANAGED_EMOJI: knownDiscordApiTypeFlags.MANAGED_EMOJI,
    EMBEDDED_IAP: knownDiscordApiTypeFlags.EMBEDDED_IAP,
    GROUP_DM_CREATE: knownDiscordApiTypeFlags.GROUP_DM_CREATE,
    APPLICATION_AUTO_MODERATION_RULE_CREATE_BADGE: documentedDiscordFlags.APPLICATION_AUTO_MODERATION_RULE_CREATE_BADGE,
    RPC_HAS_CONNECTED: knownDiscordApiTypeFlags.RPC_HAS_CONNECTED,
    GATEWAY_PRESENCE: documentedDiscordFlags.GATEWAY_PRESENCE,
    GATEWAY_PRESENCE_LIMITED: documentedDiscordFlags.GATEWAY_PRESENCE_LIMITED,
    GATEWAY_GUILD_MEMBERS: documentedDiscordFlags.GATEWAY_GUILD_MEMBERS,
    GATEWAY_GUILD_MEMBERS_LIMITED: documentedDiscordFlags.GATEWAY_GUILD_MEMBERS_LIMITED,
    VERIFICATION_PENDING_GUILD_LIMIT: documentedDiscordFlags.VERIFICATION_PENDING_GUILD_LIMIT,
    EMBEDDED: documentedDiscordFlags.EMBEDDED,
    GATEWAY_MESSAGE_CONTENT: documentedDiscordFlags.GATEWAY_MESSAGE_CONTENT,
    GATEWAY_MESSAGE_CONTENT_LIMITED: documentedDiscordFlags.GATEWAY_MESSAGE_CONTENT_LIMITED,
    EMBEDDED_FIRST_PARTY: knownDiscordApiTypeFlags.EMBEDDED_FIRST_PARTY,
    APPLICATION_COMMAND_BADGE: documentedDiscordFlags.APPLICATION_COMMAND_BADGE,
};

const expectedApplicationFlagNames = Object.keys(expectedApplicationFlags);

test("ApplicationFlags match documented and known Discord application flag bits", () => {
    assert.deepEqual(ApplicationFlags.FLAGS, expectedApplicationFlags);
});

test("ApplicationFlags support named, number, and bigint bitfield operations while preserving unknown bits", () => {
    const unknownFutureFlag = 1n << 30n;
    const flags = new ApplicationFlags(["GATEWAY_PRESENCE", Number(ApplicationFlags.FLAGS.EMBEDDED), unknownFutureFlag]);

    assert.equal(flags.has("GATEWAY_PRESENCE"), true);
    assert.equal(flags.has(Number(ApplicationFlags.FLAGS.EMBEDDED)), true);
    assert.equal(flags.has(ApplicationFlags.FLAGS.EMBEDDED), true);
    assert.equal(flags.has("GATEWAY_GUILD_MEMBERS"), false);
    assert.equal(flags.has(unknownFutureFlag), true);

    flags.add("GATEWAY_GUILD_MEMBERS");
    assert.equal(flags.has(["GATEWAY_PRESENCE", "GATEWAY_GUILD_MEMBERS"]), true);

    flags.remove("GATEWAY_PRESENCE");
    assert.equal(flags.has("GATEWAY_PRESENCE"), false);
    assert.equal(flags.has(unknownFutureFlag), true);
});

test("ApplicationFlags inherited helpers use application flag names", () => {
    const flags = new ApplicationFlags(["EMBEDDED_RELEASED", "GATEWAY_PRESENCE", "APPLICATION_COMMAND_BADGE"]);

    assert.deepEqual(flags.toArray(), ["EMBEDDED_RELEASED", "GATEWAY_PRESENCE", "APPLICATION_COMMAND_BADGE"]);
    assert.deepEqual(flags.missing(["EMBEDDED_RELEASED", "GATEWAY_PRESENCE", "GATEWAY_GUILD_MEMBERS"]), ["GATEWAY_GUILD_MEMBERS"]);
    assert.deepEqual(flags.missing(new ApplicationFlags(["EMBEDDED_RELEASED", "GATEWAY_PRESENCE", "GATEWAY_GUILD_MEMBERS"])), ["GATEWAY_GUILD_MEMBERS"]);
    assert.deepEqual(flags.serialize(), Object.fromEntries(expectedApplicationFlagNames.map((name) => [name, flags.has(name)])));
});

test("ApplicationFlags immutable operations preserve the subclass and named flags", () => {
    const frozen = new ApplicationFlags("EMBEDDED_RELEASED").freeze();

    const added = frozen.add("GATEWAY_PRESENCE");
    assert.ok(added instanceof ApplicationFlags);
    assert.notEqual(added, frozen);
    assert.equal(added.has(["EMBEDDED_RELEASED", "GATEWAY_PRESENCE"]), true);
    assert.deepEqual(added.toArray(), ["EMBEDDED_RELEASED", "GATEWAY_PRESENCE"]);
    assert.deepEqual(frozen.toArray(), ["EMBEDDED_RELEASED"]);

    const removed = frozen.remove("EMBEDDED_RELEASED");
    assert.ok(removed instanceof ApplicationFlags);
    assert.notEqual(removed, frozen);
    assert.deepEqual(removed.toArray(), []);
    assert.deepEqual(frozen.toArray(), ["EMBEDDED_RELEASED"]);
});
