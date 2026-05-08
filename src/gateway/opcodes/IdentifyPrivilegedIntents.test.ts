import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Intents } from "@spacebar/util";
import {
    APPLICATION_FLAG_GATEWAY_GUILD_MEMBERS,
    APPLICATION_FLAG_GATEWAY_GUILD_MEMBERS_LIMITED,
    APPLICATION_FLAG_GATEWAY_MESSAGE_CONTENT,
    APPLICATION_FLAG_GATEWAY_MESSAGE_CONTENT_LIMITED,
    APPLICATION_FLAG_GATEWAY_PRESENCE,
    APPLICATION_FLAG_GATEWAY_PRESENCE_LIMITED,
    DEFAULT_IDENTIFY_INTENTS,
    getConfiguredPrivilegedIntents,
    getDisallowedPrivilegedIntents,
    getRequestedIdentifyIntents,
    hasDisallowedPrivilegedIntents,
} from "./IdentifyPrivilegedIntents";

describe("IDENTIFY privileged intent validation", () => {
    it("preserves historical behavior unless the gateway config defines privileged intents", () => {
        const requested = new Intents(Intents.PRIVILEGED_FLAGS);
        const configured = getConfiguredPrivilegedIntents(undefined);

        assert.equal(configured.bitfield, 0n);
        assert.equal(hasDisallowedPrivilegedIntents(requested, configured, 0), false);
    });

    it("preserves an explicit zero intents request instead of applying the default mask", () => {
        assert.equal(getRequestedIdentifyIntents(0n).bitfield, 0n);
        assert.equal(getRequestedIdentifyIntents(undefined).bitfield, DEFAULT_IDENTIFY_INTENTS);
        assert.equal(getRequestedIdentifyIntents(null).bitfield, DEFAULT_IDENTIFY_INTENTS);
    });

    it("parses configured privileged intent masks from numbers and strings", () => {
        assert.equal(getConfiguredPrivilegedIntents(Number(Intents.FLAGS.GUILD_MEMBERS)).bitfield, Intents.FLAGS.GUILD_MEMBERS);
        assert.equal(getConfiguredPrivilegedIntents(Intents.FLAGS.GUILD_PRESENCES.toString()).bitfield, Intents.FLAGS.GUILD_PRESENCES);
        assert.equal(getConfiguredPrivilegedIntents("0x8000").bitfield, Intents.FLAGS.GUILD_MESSAGES_CONTENT);
        assert.equal(getConfiguredPrivilegedIntents(null).bitfield, 0n);
    });

    it("rejects configured privileged intents when the application lacks approval flags", () => {
        const requested = new Intents(Intents.FLAGS.GUILD_MEMBERS | Intents.FLAGS.GUILD_PRESENCES | Intents.FLAGS.GUILD_MESSAGES_CONTENT);
        const configured = new Intents(Intents.PRIVILEGED_FLAGS);

        const disallowed = getDisallowedPrivilegedIntents(requested, configured, 0);

        assert.equal(disallowed.has(Intents.FLAGS.GUILD_MEMBERS), true);
        assert.equal(disallowed.has(Intents.FLAGS.GUILD_PRESENCES), true);
        assert.equal(disallowed.has(Intents.FLAGS.GUILD_MESSAGES_CONTENT), true);
        assert.equal(hasDisallowedPrivilegedIntents(requested, configured, undefined), true);
    });

    it("accepts privileged intents approved by either full or limited Discord application flags", () => {
        const requested = new Intents(Intents.PRIVILEGED_FLAGS);
        const configured = new Intents(Intents.PRIVILEGED_FLAGS);
        const fullFlags = APPLICATION_FLAG_GATEWAY_GUILD_MEMBERS | APPLICATION_FLAG_GATEWAY_PRESENCE | APPLICATION_FLAG_GATEWAY_MESSAGE_CONTENT;
        const limitedFlags = APPLICATION_FLAG_GATEWAY_GUILD_MEMBERS_LIMITED | APPLICATION_FLAG_GATEWAY_PRESENCE_LIMITED | APPLICATION_FLAG_GATEWAY_MESSAGE_CONTENT_LIMITED;

        assert.equal(hasDisallowedPrivilegedIntents(requested, configured, fullFlags), false);
        assert.equal(hasDisallowedPrivilegedIntents(requested, configured, limitedFlags), false);
    });

    it("only enforces the privileged bits selected by configuration", () => {
        const requested = new Intents(Intents.FLAGS.GUILD_MEMBERS | Intents.FLAGS.GUILD_PRESENCES);
        const configured = new Intents(Intents.FLAGS.GUILD_MEMBERS);

        const disallowed = getDisallowedPrivilegedIntents(requested, configured, APPLICATION_FLAG_GATEWAY_PRESENCE);

        assert.equal(disallowed.has(Intents.FLAGS.GUILD_MEMBERS), true);
        assert.equal(disallowed.has(Intents.FLAGS.GUILD_PRESENCES), false);
    });

    it("does not reject non-privileged intents", () => {
        const requested = new Intents(Intents.FLAGS.GUILDS | Intents.FLAGS.GUILD_MESSAGES);
        const configured = new Intents(Intents.PRIVILEGED_FLAGS);

        assert.equal(hasDisallowedPrivilegedIntents(requested, configured, 0), false);
    });
});
