import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Intents } from "@spacebar/util";
import { getSessionGatewayIntents, setSessionGatewayIntents } from "./SessionIntents";

describe("session gateway intents", () => {
    test("defaults resumed sessions without stored gateway intents to no intents", () => {
        assert.equal(getSessionGatewayIntents(undefined).bitfield, 0n);
        assert.equal(getSessionGatewayIntents({}).bitfield, 0n);
    });

    test("restores gateway intents persisted during identify", () => {
        const session: { gateway_intents?: string } = {};
        const intents = new Intents(Intents.FLAGS.GUILD_MEMBERS | Intents.FLAGS.GUILD_PRESENCES);

        setSessionGatewayIntents(session, intents);

        assert.equal(session.gateway_intents, intents.bitfield.toString());
        assert.equal(getSessionGatewayIntents(session).has(Intents.FLAGS.GUILD_MEMBERS), true);
        assert.equal(getSessionGatewayIntents(session).has(Intents.FLAGS.GUILD_PRESENCES), true);
    });
});
