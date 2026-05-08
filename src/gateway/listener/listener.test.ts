import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CLOSECODES } from "../util";
import { canDispatchGuildPresenceUpdate, handleListenerControlEvent } from "./listener";
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

describe("handleListenerControlEvent", () => {
    test("closes the websocket when the current token is invalidated", async () => {
        const closes: Array<{ code?: number; reason?: string }> = [];
        const socket = {
            sequence: 0,
            close: (code?: number, reason?: string) => {
                closes.push({ code, reason });
            },
        };

        const handled = await handleListenerControlEvent.call(socket, {
            event: "INVALIDATED",
            data: {},
            cancel: () => undefined,
        });

        assert.equal(handled, true);
        assert.deepEqual(closes, [{ code: CLOSECODES.Authentication_failed, reason: "Invalidated Token" }]);
        assert.equal(socket.sequence, 0);
    });

    test("leaves ordinary dispatch events to the gateway consumer", async () => {
        const socket = {
            sequence: 0,
            close: () => {
                throw new Error("ordinary events must not be closed by control handling");
            },
        };

        const handled = await handleListenerControlEvent.call(socket, {
            event: "MESSAGE_CREATE",
            data: { id: "message", channel_id: "channel" },
            cancel: () => undefined,
        });

        assert.equal(handled, false);
    });
});
