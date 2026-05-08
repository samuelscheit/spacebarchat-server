import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Intents } from "../../util/util/Intents";
import { canDispatchGuildPresenceUpdate, canDispatchUserDelete } from "./listener";
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
