process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar-test";

import { describe, test } from "node:test";
import assert from "node:assert/strict";

const util = require("@spacebar/util");
const { joinGuildMember, isLurkerJoinRequest } = require("./GuildMemberJoin");

type Rights = { hasThrow: (right: string) => void };

function installHarness(options: { memberCount?: number; guildFeatures?: string[] } = {}) {
    const rightsChecked: string[] = [];
    const addToGuildCalls: Array<{ user_id: string; guild_id: string }> = [];
    const findCalls: Array<{ entity: string; query: unknown }> = [];
    const rights: Rights = { hasThrow: (right) => rightsChecked.push(right) };
    const dependencies = {
        configGet: () => ({ user: { botsCanUseInvites: false } }),
        getRights: async () => rights,
        memberCount: async (query: unknown) => {
            findCalls.push({ entity: "Member.count", query });
            return options.memberCount ?? 0;
        },
        memberAddToGuild: async (user_id: string, guild_id: string) => {
            addToGuildCalls.push({ user_id, guild_id });
        },
        guildFindOneOrFail: async (query: unknown) => {
            findCalls.push({ entity: "Guild.findOneOrFail", query });
            return { id: "guild-id", name: "Guild", features: options.guildFeatures ?? ["DISCOVERABLE"] };
        },
        emojiFind: async (query: unknown) => {
            findCalls.push({ entity: "Emoji.find", query });
            return [{ id: "emoji-id" }];
        },
        roleFind: async (query: unknown) => {
            findCalls.push({ entity: "Role.find", query });
            return [{ id: "role-id" }];
        },
        stickerFind: async (query: unknown) => {
            findCalls.push({ entity: "Sticker.find", query });
            return [{ id: "sticker-id" }];
        },
    };

    return { rightsChecked, addToGuildCalls, findCalls, dependencies };
}

describe("isLurkerJoinRequest", () => {
    test("accepts Discord's lurker=true query value", () => {
        assert.equal(isLurkerJoinRequest({ lurker: "true" }), true);
        assert.equal(isLurkerJoinRequest({ lurker: true }), true);
        assert.equal(isLurkerJoinRequest({ lurker: "false" }), false);
        assert.equal(isLurkerJoinRequest({}), false);
    });
});

describe("joinGuildMember", () => {
    test("returns 204 for lurker=true when the requesting user is already a guild member", async () => {
        const harness = installHarness({ memberCount: 1 });
        const result = await joinGuildMember({ guild_id: "guild-id", member_id: "@me", user_id: "user-id", query: { lurker: "true" } }, harness.dependencies);
        assert.deepEqual(result, { status: 204 });
        assert.deepEqual(harness.rightsChecked, ["JOIN_GUILDS"]);
        assert.deepEqual(harness.addToGuildCalls, []);
        assert.deepEqual(
            harness.findCalls.map((x) => x.entity),
            ["Member.count"],
        );
    });

    test("falls through to the normal discoverable guild join when lurker=true has no existing membership", async () => {
        const harness = installHarness({ memberCount: 0 });
        const result = await joinGuildMember({ guild_id: "guild-id", member_id: "@me", user_id: "user-id", query: { lurker: "true" } }, harness.dependencies);
        assert.equal(result.status, 200);
        assert.deepEqual(harness.addToGuildCalls, [{ user_id: "user-id", guild_id: "guild-id" }]);
        assert.deepEqual(
            harness.findCalls.map((x) => x.entity),
            ["Member.count", "Guild.findOneOrFail", "Emoji.find", "Role.find", "Sticker.find"],
        );
    });

    test("preserves the missing OAuth scope error for non-@me member ids", async () => {
        const harness = installHarness();
        await assert.rejects(
            joinGuildMember({ guild_id: "guild-id", member_id: "other-user-id", user_id: "user-id", query: { lurker: "true" } }, harness.dependencies),
            util.DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE,
        );
        assert.deepEqual(harness.findCalls, []);
        assert.deepEqual(harness.addToGuildCalls, []);
    });
});
