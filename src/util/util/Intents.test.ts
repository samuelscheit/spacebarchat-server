import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Intents } from "./Intents";

describe("Intents", () => {
    it("documents the legacy default identify intent mask", () => {
        const allIntentBitsThrough34 = (BigInt(1) << BigInt(35)) - BigInt(1);
        const expectedDefault = allIntentBitsThrough34 & ~Intents.ERKINALP_FLAGS.LIVE_MESSAGE_COMPOSITION;

        assert.equal(Intents.DEFAULT_GATEWAY_IDENTIFY_INTENTS, expectedDefault);
        assert.equal(Intents.DEFAULT_GATEWAY_IDENTIFY_INTENTS, 0b11011111111111111111111111111111111n);
        assert.equal(Intents.DEFAULT_GATEWAY_IDENTIFY_INTENTS.toString(), "30064771071");
    });

    it("does not implicitly enable live message composition for clients that omit intents", () => {
        const defaultIntents = new Intents(Intents.DEFAULT_GATEWAY_IDENTIFY_INTENTS);

        assert.equal(defaultIntents.has(Intents.ERKINALP_FLAGS.LIVE_MESSAGE_COMPOSITION), false);
        assert.equal(defaultIntents.has(Intents.FLAGS.GUILDS), true);
        assert.equal(defaultIntents.has(BigInt(1) << BigInt(34)), true);
    });

    it("defaults only missing identify intents", () => {
        assert.equal(Intents.resolveGatewayIdentifyIntents(undefined), Intents.DEFAULT_GATEWAY_IDENTIFY_INTENTS);
        assert.equal(Intents.resolveGatewayIdentifyIntents(null), Intents.DEFAULT_GATEWAY_IDENTIFY_INTENTS);
        assert.equal(Intents.resolveGatewayIdentifyIntents(BigInt(0)), BigInt(0));
        assert.equal(Intents.resolveGatewayIdentifyIntents(0), BigInt(0));
        assert.equal(Intents.resolveGatewayIdentifyIntents("0"), BigInt(0));
        assert.equal(Intents.resolveGatewayIdentifyIntents(Intents.FLAGS.GUILDS), Intents.FLAGS.GUILDS);
    });
});
