import assert from "node:assert/strict";
import { afterEach, describe, mock, test } from "node:test";
import type { EventOpts } from "../../util";
import { Intents } from "../../util/util/Intents";
import { OPCODES } from "../util";
import { canDispatchByIntent, canDispatchGuildPresenceUpdate, canDispatchUserDelete, setupListener } from "./listener";
import { trackGuildMemberEventId } from "./subscriptions";

afterEach(() => {
    mock.restoreAll();
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

describe("setupListener USER_DELETE dispatch", () => {
    test("filters USER_DELETE events by the identified session intent before sending", async () => {
        mockEmptyListenerStores();
        const sentPayloads: unknown[] = [];
        const SendUtil = require("../util/Send") as typeof import("../util/Send");
        mock.method(SendUtil, "Send", async (_socket: unknown, payload: unknown) => {
            sentPayloads.push(payload);
        });

        await dispatchUserDeleteWithIntents(new Intents());
        assert.deepEqual(sentPayloads, []);

        await dispatchUserDeleteWithIntents(new Intents(Intents.ERKINALP_FLAGS.INSTANCE_USER_UPDATES));
        assert.deepEqual(sentPayloads, [
            {
                op: OPCODES.Dispatch,
                t: "USER_DELETE",
                d: { user_id: "deleted-user" },
                s: 0,
            },
        ]);
    });
});

function mockEmptyListenerStores() {
    const { Member, Recipient, Relationship } = require("@spacebar/util") as typeof import("../../util");

    mock.method(Member, "find", async () => []);
    mock.method(Recipient, "find", async () => []);
    mock.method(Relationship, "find", async () => []);
}

async function dispatchUserDeleteWithIntents(intents: Intents) {
    const { events } = require("@spacebar/util") as typeof import("../../util");
    const intentKey = intents.bitfield.toString();
    const userId = `listener-user-${intentKey}`;
    const sessionId = `listener-session-${intentKey}`;
    const closeListeners: Array<() => void> = [];
    const socket = {
        user_id: userId,
        session_id: sessionId,
        intents,
        recentTransactions: [],
        events: {},
        member_events: {},
        guild_event_ids: {},
        guild_member_event_ids: {},
        member_event_guild_ids: {},
        permissions: {},
        sequence: 0,
        once(event: string, listener: () => void) {
            if (event === "close") closeListeners.push(listener);
            return this;
        },
    };

    try {
        await setupListener.call(socket as never);
        events.emit(userId, {
            event: "USER_DELETE",
            user_id: userId,
            data: { user_id: "deleted-user" },
        } as EventOpts);
        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });
    } finally {
        for (const listener of closeListeners) listener();
        await (socket as { closeCleanup?: Promise<unknown> }).closeCleanup;
        events.removeAllListeners(userId);
        events.removeAllListeners(sessionId);
    }
}

describe("canDispatchUserDelete", () => {
    test("requires the instance user updates intent", () => {
        assert.equal(canDispatchUserDelete(new Intents()), false);
        assert.equal(canDispatchUserDelete(new Intents(Intents.FLAGS.GUILDS)), false);
        assert.equal(canDispatchUserDelete(new Intents(Intents.ERKINALP_FLAGS.INSTANCE_USER_UPDATES)), true);
    });

    test("does not dispatch before identify initializes intents", () => {
        assert.equal(canDispatchUserDelete(undefined), false);
    });
});

describe("canDispatchByIntent", () => {
    test("gates only USER_DELETE on the instance user updates intent", () => {
        assert.equal(canDispatchByIntent("USER_DELETE", new Intents()), false);
        assert.equal(canDispatchByIntent("USER_DELETE", new Intents(Intents.ERKINALP_FLAGS.INSTANCE_USER_UPDATES)), true);
    });

    test("does not let core gateway events fall through into USER_DELETE gating", () => {
        const intents = new Intents();

        for (const event of [
            "READY",
            "GUILD_CREATE",
            "GUILD_DELETE",
            "GUILD_UPDATE",
            "GUILD_ROLE_CREATE",
            "GUILD_ROLE_UPDATE",
            "GUILD_ROLE_DELETE",
            "CHANNEL_CREATE",
            "CHANNEL_DELETE",
            "CHANNEL_UPDATE",
            "GUILD_EMOJI_UPDATE",
            "GUILD_EMOJIS_UPDATE",
        ] as const) {
            assert.equal(canDispatchByIntent(event, intents), true, `${event} should not require INSTANCE_USER_UPDATES`);
        }
    });
});
