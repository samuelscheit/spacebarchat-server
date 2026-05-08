import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Intents } from "@spacebar/util";
import { canDispatchEventForIntent, canDispatchGuildPresenceUpdate } from "./listener";
import { trackGuildMemberEventId } from "./subscriptions";

describe("canDispatchEventForIntent", () => {
    test("allows events that are not mapped to a gateway intent", () => {
        assert.equal(canDispatchEventForIntent(new Intents(0), "USER_UPDATE"), true);
        assert.equal(canDispatchEventForIntent(undefined, "APPLICATION_COMMAND_UPDATE", "guild"), true);
    });

    test("requires guild intents for guild-routed events", () => {
        const guildMessages = new Intents(Intents.FLAGS.GUILD_MESSAGES);
        const dmMessages = new Intents(Intents.FLAGS.DIRECT_MESSAGES);

        assert.equal(canDispatchEventForIntent(guildMessages, "MESSAGE_CREATE", "guild"), true);
        assert.equal(canDispatchEventForIntent(dmMessages, "MESSAGE_CREATE", "guild"), false);
        assert.equal(canDispatchEventForIntent(new Intents(0), "MESSAGE_CREATE", "guild"), false);
    });

    test("requires direct message intents for non-guild message events", () => {
        const directMessages = new Intents(Intents.FLAGS.DIRECT_MESSAGES);
        const guildMessages = new Intents(Intents.FLAGS.GUILD_MESSAGES);

        assert.equal(canDispatchEventForIntent(directMessages, "MESSAGE_CREATE"), true);
        assert.equal(canDispatchEventForIntent(guildMessages, "MESSAGE_CREATE"), false);
    });

    test("requires guild presence intent for presence updates", () => {
        const guildPresences = new Intents(Intents.FLAGS.GUILD_PRESENCES);

        assert.equal(canDispatchEventForIntent(guildPresences, "PRESENCE_UPDATE", "guild"), true);
        assert.equal(canDispatchEventForIntent(new Intents(0), "PRESENCE_UPDATE", "guild"), false);
    });

    test("allows current-user guild member updates without the guild members intent", () => {
        assert.equal(canDispatchEventForIntent(new Intents(0), "GUILD_MEMBER_UPDATE", "guild", "current-user", "current-user"), true);
        assert.equal(canDispatchEventForIntent(new Intents(0), "GUILD_MEMBER_UPDATE", "guild", "other-user", "current-user"), false);
    });

    test("requires mapped non-route intents", () => {
        const autoModeration = new Intents(Intents.FLAGS.AUTO_MODERATION_CONFIGURATION);

        assert.equal(canDispatchEventForIntent(autoModeration, "AUTO_MODERATION_RULE_CREATE", "guild"), true);
        assert.equal(canDispatchEventForIntent(new Intents(0), "AUTO_MODERATION_RULE_CREATE", "guild"), false);
    });
});

describe("canDispatchGuildPresenceUpdate", () => {
    test("allows direct user presence routes used for friends and DMs", () => {
        assert.equal(canDispatchGuildPresenceUpdate({}, undefined, "member"), true);
    });

    test("allows guild presence routes only for tracked lazy member subscriptions", () => {
        const guildMemberEventIds: Record<string, Set<string>> = {};
        const memberEventGuildIds: Record<string, Set<string>> = {};
        trackGuildMemberEventId(guildMemberEventIds, memberEventGuildIds, "guild", "visible-member");

        assert.equal(canDispatchGuildPresenceUpdate(guildMemberEventIds, "guild", "visible-member"), true);
        assert.equal(canDispatchGuildPresenceUpdate(guildMemberEventIds, "guild", "hidden-member"), false);
        assert.equal(canDispatchGuildPresenceUpdate(guildMemberEventIds, "guild", undefined), false);
    });
});
