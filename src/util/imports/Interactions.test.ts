import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

function readSource(path: string): string {
    return readFileSync(join(process.cwd(), path), "utf8");
}

function indexOf(source: string, fragment: string, fromIndex = 0): number {
    const index = source.indexOf(fragment, fromIndex);
    assert.notEqual(index, -1, `Expected source to contain: ${fragment}`);
    return index;
}

function assertBefore(source: string, first: string, second: string): void {
    assert.ok(indexOf(source, first) < indexOf(source, second), `Expected ${first} to appear before ${second}`);
}

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

test("deleted pending interactions reject later correct-token callbacks", () => {
    const interaction = createPendingInteraction("expected_token");
    pendingInteractions.set("interaction_id", interaction);

    pendingInteractions.delete("interaction_id");
    clearTimeout(interaction.timeout);

    assert.equal(getPendingInteractionForCallback("interaction_id", "expected_token"), undefined);
    assert.throws(() => requirePendingInteractionForCallback("interaction_id", "expected_token"), {
        code: DiscordApiErrors.UNKNOWN_INTERACTION.code,
        message: DiscordApiErrors.UNKNOWN_INTERACTION.message,
    });
});

test("interaction route stores callback token before bot event and expires timed-out entries", () => {
    const source = readSource("src/api/routes/interactions/index.ts");
    const timeoutStart = indexOf(source, "pendingInteraction.timeout = setTimeout(() => {");
    const timeoutEnd = indexOf(source, "    }, 3000);", timeoutStart);
    const timeoutBlock = source.slice(timeoutStart, timeoutEnd);
    const botEmitFailureStart = indexOf(source, "} catch (error) {");
    const botEmitFailureEnd = indexOf(source, "    }", botEmitFailureStart);
    const botEmitFailureBlock = source.slice(botEmitFailureStart, botEmitFailureEnd);

    assertBefore(source, "pendingInteractions.set(interactionId,", "user_id: body.application_id,");
    assertBefore(source, "user_id: body.application_id,", "pendingInteraction.timeout = setTimeout");
    assertBefore(timeoutBlock, "pendingInteractions.delete(interactionId);", 'event: "INTERACTION_FAILURE"');
    assertBefore(botEmitFailureBlock, "pendingInteractions.delete(interactionId);", "throw error;");
});
