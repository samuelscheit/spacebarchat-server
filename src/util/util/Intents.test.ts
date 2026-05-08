import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Intents } from "./Intents";

describe("Intents", () => {
    test("classifies auto moderation events as guild intent events", () => {
        assert.equal(Intents.INTENT_TO_EVENTS_MAP[20 as keyof typeof Intents.INTENT_TO_EVENTS_MAP], undefined);
        assert.equal(Intents.INTENT_TO_EVENTS_MAP[21 as keyof typeof Intents.INTENT_TO_EVENTS_MAP], undefined);

        assert.deepEqual(Intents.GUILD_INTENT_TO_EVENTS_MAP[20], ["AUTO_MODERATION_RULE_CREATE", "AUTO_MODERATION_RULE_UPDATE", "AUTO_MODERATION_RULE_DELETE"]);
        assert.deepEqual(Intents.GUILD_INTENT_TO_EVENTS_MAP[21], ["AUTO_MODERATION_ACTION_EXECUTION"]);
    });
});
