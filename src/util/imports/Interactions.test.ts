import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { DiscordApiErrors } from "../util/Constants";
import { getPendingInteractionForCallback, pendingInteractions, requirePendingInteractionForCallback, type PendingInteraction } from "./Interactions";

function createPendingInteraction(token: string): PendingInteraction {
    return {
        timeout: setTimeout(() => undefined, 30_000),
        token,
        applicationId: "application_id",
        userId: "user_id",
        channelId: "channel_id",
        type: 2 as PendingInteraction["type"],
    };
}

afterEach(() => {
    for (const interaction of pendingInteractions.values()) {
        clearTimeout(interaction.timeout);
    }
    pendingInteractions.clear();
});

test("getPendingInteractionForCallback requires the generated callback token", () => {
    const interaction = createPendingInteraction("expected_token");
    pendingInteractions.set("interaction_id", interaction);

    assert.equal(getPendingInteractionForCallback("interaction_id", "expected_token"), interaction);
    assert.equal(getPendingInteractionForCallback("interaction_id", "wrong_token"), undefined);
    assert.equal(getPendingInteractionForCallback("interaction_id", undefined), undefined);
    assert.equal(getPendingInteractionForCallback("missing_interaction_id", "expected_token"), undefined);
});

test("requirePendingInteractionForCallback rejects missing or mismatched tokens", () => {
    const interaction = createPendingInteraction("expected_token");
    pendingInteractions.set("interaction_id", interaction);

    assert.equal(requirePendingInteractionForCallback("interaction_id", "expected_token"), interaction);
    assert.throws(() => requirePendingInteractionForCallback("interaction_id", "wrong_token"), {
        code: DiscordApiErrors.UNKNOWN_INTERACTION.code,
        message: DiscordApiErrors.UNKNOWN_INTERACTION.message,
    });
    assert.throws(() => requirePendingInteractionForCallback("interaction_id", undefined), {
        code: DiscordApiErrors.UNKNOWN_INTERACTION.code,
        message: DiscordApiErrors.UNKNOWN_INTERACTION.message,
    });
});
