import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { EventOpts, Intents } from "@spacebar/util";
import {
    canDispatchGuildPresenceUpdate,
    canDispatchIntentEvent,
    shouldSubscribeDirectMessageEvents,
    shouldSubscribeGuildChannelEvents,
    shouldSubscribeGuildEvents,
    shouldSubscribePresenceEvents,
} from "./listener";
import { trackGuildMemberEventId } from "./subscriptions";

function eventOpts(event: string, data: Record<string, unknown> = {}, guild_id?: string, channel_id?: string) {
    return { event, data, guild_id, channel_id } as Pick<EventOpts, "channel_id" | "data" | "event" | "guild_id">;
}

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

describe("gateway listener intent filtering", () => {
    test("allows guild events only when their connection intent is present", () => {
        const noIntents = new Intents(0n);
        const guildMessages = new Intents(Intents.FLAGS.GUILD_MESSAGES);

        assert.equal(canDispatchIntentEvent(noIntents, eventOpts("MESSAGE_CREATE", { guild_id: "guild" })), false);
        assert.equal(canDispatchIntentEvent(guildMessages, eventOpts("MESSAGE_CREATE", { guild_id: "guild" })), true);
    });

    test("uses direct message intents for non-guild message routes", () => {
        const guildMessages = new Intents(Intents.FLAGS.GUILD_MESSAGES);
        const directMessages = new Intents(Intents.FLAGS.DIRECT_MESSAGES);

        assert.equal(canDispatchIntentEvent(guildMessages, eventOpts("MESSAGE_CREATE", { channel_id: "dm" })), false);
        assert.equal(canDispatchIntentEvent(directMessages, eventOpts("MESSAGE_CREATE", { channel_id: "dm" })), true);
    });

    test("uses tracked guild channel routes when guild message payloads omit guild_id", () => {
        const guildMessages = new Intents(Intents.FLAGS.GUILD_MESSAGES);
        const directMessages = new Intents(Intents.FLAGS.DIRECT_MESSAGES);
        const guildEventIds = { guild: new Set(["guild-channel"]) };
        const guildMessageRoute = eventOpts("MESSAGE_CREATE", { id: "message", channel_id: "guild-channel" }, undefined, "guild-channel");
        const directMessageRoute = eventOpts("MESSAGE_CREATE", { id: "message", channel_id: "dm-channel" }, undefined, "dm-channel");
        const guildMessageWithoutTopLevelChannel = eventOpts("MESSAGE_CREATE", { id: "message", channel_id: "guild-channel" });

        assert.equal(canDispatchIntentEvent(guildMessages, guildMessageRoute, guildEventIds), true);
        assert.equal(canDispatchIntentEvent(guildMessages, guildMessageWithoutTopLevelChannel, guildEventIds), true);
        assert.equal(canDispatchIntentEvent(directMessages, guildMessageRoute, guildEventIds), false);
        assert.equal(canDispatchIntentEvent(directMessages, directMessageRoute, guildEventIds), true);
    });

    test("requires the guild presences intent for presence updates", () => {
        const noIntents = new Intents(0n);
        const guildPresences = new Intents(Intents.FLAGS.GUILD_PRESENCES);

        assert.equal(canDispatchIntentEvent(noIntents, eventOpts("PRESENCE_UPDATE", { guild_id: "guild" })), false);
        assert.equal(canDispatchIntentEvent(guildPresences, eventOpts("PRESENCE_UPDATE", { guild_id: "guild" })), true);
    });

    test("keeps custom and internal listener events as passthrough", () => {
        const noIntents = new Intents(0n);

        assert.equal(canDispatchIntentEvent(noIntents, eventOpts("SPACEBAR_CUSTOM_EVENT")), true);
        assert.equal(canDispatchIntentEvent(noIntents, eventOpts("SB_SESSION_CLOSE")), true);
    });

    test("derives route subscription categories from connection intents", () => {
        const noIntents = new Intents(0n);
        const directMessages = new Intents(Intents.FLAGS.DIRECT_MESSAGES);
        const guilds = new Intents(Intents.FLAGS.GUILDS);
        const guildMembers = new Intents(Intents.FLAGS.GUILD_MEMBERS);
        const guildInvites = new Intents(Intents.FLAGS.GUILD_INVITES);
        const guildMessages = new Intents(Intents.FLAGS.GUILD_MESSAGES);
        const presences = new Intents(Intents.FLAGS.GUILD_PRESENCES);

        assert.equal(shouldSubscribeDirectMessageEvents(noIntents), false);
        assert.equal(shouldSubscribeGuildEvents(noIntents), false);
        assert.equal(shouldSubscribeGuildChannelEvents(noIntents), false);
        assert.equal(shouldSubscribePresenceEvents(noIntents), false);

        assert.equal(shouldSubscribeDirectMessageEvents(directMessages), true);
        assert.equal(shouldSubscribeGuildEvents(guilds), true);
        assert.equal(shouldSubscribeGuildChannelEvents(guilds), true);
        assert.equal(shouldSubscribeGuildEvents(guildMembers), true);
        assert.equal(shouldSubscribeGuildChannelEvents(guildMembers), false);
        assert.equal(shouldSubscribeGuildEvents(guildInvites), true);
        assert.equal(shouldSubscribeGuildChannelEvents(guildInvites), false);
        assert.equal(shouldSubscribeGuildEvents(guildMessages), true);
        assert.equal(shouldSubscribeGuildChannelEvents(guildMessages), true);
        assert.equal(shouldSubscribePresenceEvents(presences), true);
        assert.equal(shouldSubscribeGuildChannelEvents(presences), false);
    });

    test("uses direct message intents for non-guild channel lifecycle events", () => {
        const guilds = new Intents(Intents.FLAGS.GUILDS);
        const directMessages = new Intents(Intents.FLAGS.DIRECT_MESSAGES);
        const guildChannelCreate = eventOpts("CHANNEL_CREATE", { id: "guild-channel", guild_id: "guild" });
        const directChannelCreate = eventOpts("CHANNEL_CREATE", { id: "dm-channel", type: 1 });

        assert.equal(canDispatchIntentEvent(guilds, guildChannelCreate), true);
        assert.equal(canDispatchIntentEvent(directMessages, guildChannelCreate), false);
        assert.equal(canDispatchIntentEvent(guilds, directChannelCreate), false);
        assert.equal(canDispatchIntentEvent(directMessages, directChannelCreate), true);
        assert.equal(canDispatchIntentEvent(directMessages, eventOpts("CHANNEL_RECIPIENT_REMOVE", { channel_id: "dm-channel" })), true);
    });

    test("uses current invite and thread member event names from the intent maps", () => {
        assert.ok(Intents.GUILD_INTENT_TO_EVENTS_MAP[6].includes("INVITE_CREATE"));
        assert.ok(Intents.GUILD_INTENT_TO_EVENTS_MAP[6].includes("INVITE_DELETE"));
        assert.ok(Intents.GUILD_INTENT_TO_EVENTS_MAP[1].includes("THREAD_MEMBERS_UPDATE"));
        assert.equal(Intents.GUILD_INTENT_TO_EVENTS_MAP[1].includes("THREAD_MEMBERS_UPDATE "), false);
    });
});
