import { describe, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { Config } from "@spacebar/util";
import { assertMessagePayloadLimits } from "./MessagePayloadLimits";

function mockMessageLimits(t: TestContext, limits: { maxCharacters: number; maxTTSCharacters: number; maxEmbeds: number }) {
    t.mock.method(Config, "get", () => ({
        limits: {
            message: limits,
        },
    }));
}

describe("assertMessagePayloadLimits", () => {
    test("accepts message content at the configured character limit", (t) => {
        mockMessageLimits(t, { maxCharacters: 5, maxTTSCharacters: 5, maxEmbeds: 1 });

        assert.doesNotThrow(() => assertMessagePayloadLimits({ content: "12345", embeds: [{}], tts: false }));
    });

    test("rejects message content over the current configured character limit", (t) => {
        mockMessageLimits(t, { maxCharacters: 5, maxTTSCharacters: 5, maxEmbeds: 1 });

        assert.throws(
            () => assertMessagePayloadLimits({ content: "123456" }),
            (error: unknown) => {
                assert.equal((error as { code?: unknown }).code, 50035);
                assert.deepEqual((error as { errors?: Record<string, unknown> }).errors?.content, {
                    _errors: [{ code: "BASE_TYPE_MAX_LENGTH", message: "Must be 5 or fewer in length." }],
                });
                return true;
            },
        );
    });

    test("uses changed configuration without rebuilding schemas", (t) => {
        mockMessageLimits(t, { maxCharacters: 8, maxTTSCharacters: 8, maxEmbeds: 1 });

        assert.doesNotThrow(() => assertMessagePayloadLimits({ content: "12345678" }));
        assert.throws(() => assertMessagePayloadLimits({ content: "123456789" }));
    });

    test("rejects TTS content over the configured TTS character limit", (t) => {
        mockMessageLimits(t, { maxCharacters: 100, maxTTSCharacters: 3, maxEmbeds: 1 });

        assert.throws(
            () => assertMessagePayloadLimits({ content: "1234", tts: true }),
            (error: unknown) => {
                assert.deepEqual((error as { errors?: Record<string, unknown> }).errors?.content, {
                    _errors: [{ code: "BASE_TYPE_MAX_LENGTH", message: "TTS messages must be 3 or fewer in length." }],
                });
                return true;
            },
        );
    });

    test("rejects explicit embeds over the configured embed count", (t) => {
        mockMessageLimits(t, { maxCharacters: 100, maxTTSCharacters: 100, maxEmbeds: 1 });

        assert.throws(
            () => assertMessagePayloadLimits({ embeds: [{}, {}] }),
            (error: unknown) => {
                assert.deepEqual((error as { errors?: Record<string, unknown> }).errors?.embeds, {
                    _errors: [{ code: "BASE_TYPE_MAX_ITEMS", message: "Must contain 1 or fewer items." }],
                });
                return true;
            },
        );
    });
});
