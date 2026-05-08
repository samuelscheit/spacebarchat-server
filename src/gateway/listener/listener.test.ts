import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Intents } from "@spacebar/util";
import { canDispatchEventForIntents, canDispatchGuildPresenceUpdate, getIntentGuildIdForEvent, getRequiredIntentForEvent } from "./listener";
import { trackGuildMemberEventId } from "./subscriptions";

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

describe("gateway intent dispatch filtering", () => {
    test("maps guild events to their required guild intent", () => {
        assert.equal(getRequiredIntentForEvent("GUILD_CREATE", "guild"), Intents.FLAGS.GUILDS);
        assert.equal(getRequiredIntentForEvent("PRESENCE_UPDATE", "guild"), Intents.FLAGS.GUILD_PRESENCES);
        assert.equal(getRequiredIntentForEvent("INVITE_CREATE", "guild"), Intents.FLAGS.GUILD_INVITES);
    });

    test("infers guild context for user-routed guild events", () => {
        assert.equal(getIntentGuildIdForEvent({ event: "GUILD_CREATE", data: { id: "guild" } }), "guild");
        assert.equal(canDispatchEventForIntents(new Intents(0), "GUILD_CREATE", "guild"), false);
        assert.equal(canDispatchEventForIntents(new Intents(Intents.FLAGS.GUILDS), "GUILD_CREATE", "guild"), true);
    });

    test("does not infer guild context from non-guild object identifiers", () => {
        assert.equal(getIntentGuildIdForEvent({ event: "MESSAGE_CREATE", data: { id: "message" } }), undefined);
        assert.equal(getIntentGuildIdForEvent({ event: "CHANNEL_CREATE", data: { id: "channel" } }), undefined);
        assert.equal(getIntentGuildIdForEvent({ event: "MESSAGE_CREATE", data: { guild_id: "guild", id: "message" } }), "guild");
    });

    test("maps direct-message events to direct-message intents", () => {
        assert.equal(getRequiredIntentForEvent("MESSAGE_CREATE", undefined), Intents.FLAGS.DIRECT_MESSAGES);
        assert.equal(getRequiredIntentForEvent("MESSAGE_REACTION_ADD", undefined), Intents.FLAGS.DIRECT_MESSAGE_REACTIONS);
    });

    test("distinguishes shared event names by guild context", () => {
        const guildMessages = new Intents(Intents.FLAGS.GUILD_MESSAGES);
        const dmMessages = new Intents(Intents.FLAGS.DIRECT_MESSAGES);

        assert.equal(canDispatchEventForIntents(guildMessages, "MESSAGE_CREATE", "guild"), true);
        assert.equal(canDispatchEventForIntents(dmMessages, "MESSAGE_CREATE", "guild"), false);
        assert.equal(canDispatchEventForIntents(dmMessages, "MESSAGE_CREATE", undefined), true);
        assert.equal(canDispatchEventForIntents(guildMessages, "MESSAGE_CREATE", undefined), false);
        assert.equal(canDispatchEventForIntents(dmMessages, "MESSAGE_CREATE", getIntentGuildIdForEvent({ event: "MESSAGE_CREATE", data: { id: "message" } })), true);
    });

    test("allows current-user guild member updates without the guild members intent", () => {
        assert.equal(canDispatchEventForIntents(new Intents(0), "GUILD_MEMBER_UPDATE", "guild", "current-user", { user: { id: "current-user" } }), true);
        assert.equal(canDispatchEventForIntents(new Intents(0), "GUILD_MEMBER_UPDATE", "guild", "current-user", { user: { id: "other-user" } }), false);
    });

    test("requires the guild members intent for thread membership updates", () => {
        assert.equal(getRequiredIntentForEvent("THREAD_MEMBERS_UPDATE", "guild"), Intents.FLAGS.GUILD_MEMBERS);
        assert.equal(canDispatchEventForIntents(new Intents(0), "THREAD_MEMBERS_UPDATE", "guild"), false);
        assert.equal(canDispatchEventForIntents(new Intents(Intents.FLAGS.GUILDS), "THREAD_MEMBERS_UPDATE", "guild"), false);
        assert.equal(canDispatchEventForIntents(new Intents(Intents.FLAGS.GUILD_MEMBERS), "THREAD_MEMBERS_UPDATE", "guild"), true);
    });

    test("treats unmapped gateway events as passthrough", () => {
        assert.equal(canDispatchEventForIntents(new Intents(0), "USER_UPDATE", undefined), true);
        assert.equal(canDispatchEventForIntents(new Intents(0), "APPLICATION_COMMAND_CREATE", "guild"), true);
    });

    test("maps common auto moderation events to their intents", () => {
        assert.equal(getRequiredIntentForEvent("AUTO_MODERATION_RULE_CREATE", "guild"), Intents.FLAGS.AUTO_MODERATION_CONFIGURATION);
        assert.equal(getRequiredIntentForEvent("AUTO_MODERATION_ACTION_EXECUTION", "guild"), Intents.FLAGS.AUTO_MODERATION_EXECUTION);
        assert.equal(canDispatchEventForIntents(new Intents(0), "AUTO_MODERATION_RULE_CREATE", "guild"), false);
    });
});
