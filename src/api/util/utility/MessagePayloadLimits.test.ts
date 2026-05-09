import { describe, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { Config } from "@spacebar/util";
import { assertMessagePayloadLimits, validateMessagePayloadLimits } from "./MessagePayloadLimits";
import type { Request, Response } from "express";

type MessageLimitMock = {
    maxCharacters: number;
    maxTTSCharacters: number;
    maxEmbeds: number;
    maxEmbedTitle?: number;
    maxEmbedDescription?: number;
    maxEmbedFields?: number;
    maxEmbedFieldName?: number;
    maxEmbedFieldValue?: number;
    maxEmbedFooterText?: number;
    maxEmbedAuthorName?: number;
    maxEmbedCharacters?: number;
};

function mockMessageLimits(t: TestContext, limits: MessageLimitMock) {
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

    test("accepts embed text at configured field and aggregate limits", (t) => {
        mockMessageLimits(t, {
            maxCharacters: 100,
            maxTTSCharacters: 100,
            maxEmbeds: 1,
            maxEmbedTitle: 5,
            maxEmbedDescription: 5,
            maxEmbedFields: 1,
            maxEmbedFieldName: 5,
            maxEmbedFieldValue: 5,
            maxEmbedFooterText: 5,
            maxEmbedAuthorName: 5,
            maxEmbedCharacters: 30,
        });

        assert.doesNotThrow(() =>
            assertMessagePayloadLimits({
                embeds: [
                    {
                        title: "12345",
                        description: "12345",
                        footer: { text: "12345" },
                        author: { name: "12345" },
                        fields: [{ name: "12345", value: "12345" }],
                    },
                ],
            }),
        );
    });

    test("rejects embed text over configured field and aggregate limits", (t) => {
        mockMessageLimits(t, {
            maxCharacters: 100,
            maxTTSCharacters: 100,
            maxEmbeds: 1,
            maxEmbedTitle: 5,
            maxEmbedDescription: 5,
            maxEmbedFields: 1,
            maxEmbedFieldName: 5,
            maxEmbedFieldValue: 5,
            maxEmbedFooterText: 5,
            maxEmbedAuthorName: 5,
            maxEmbedCharacters: 10,
        });

        assert.throws(
            () =>
                assertMessagePayloadLimits({
                    embeds: [
                        {
                            title: "123456",
                            description: "123456",
                            footer: { text: "123456" },
                            author: { name: "123456" },
                            fields: [
                                { name: "123456", value: "123456" },
                                { name: "ok", value: "ok" },
                            ],
                        },
                    ],
                }),
            (error: unknown) => {
                const fieldError = error as { code?: unknown; errors?: Record<string, unknown> };
                assert.equal(fieldError.code, 50035);
                assert.ok(fieldError.errors?.embeds);
                assert.ok(fieldError.errors?.["embeds[0].title"]);
                assert.ok(fieldError.errors?.["embeds[0].description"]);
                assert.ok(fieldError.errors?.["embeds[0].footer.text"]);
                assert.ok(fieldError.errors?.["embeds[0].author.name"]);
                assert.ok(fieldError.errors?.["embeds[0].fields"]);
                assert.ok(fieldError.errors?.["embeds[0].fields[0].name"]);
                assert.ok(fieldError.errors?.["embeds[0].fields[0].value"]);
                return true;
            },
        );
    });

    test("middleware delegates to the dynamic assertion before continuing", (t) => {
        mockMessageLimits(t, { maxCharacters: 3, maxTTSCharacters: 3, maxEmbeds: 1 });
        let nextCalled = false;

        validateMessagePayloadLimits({ body: { content: "123" } } as Request, {} as Response, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.throws(() => validateMessagePayloadLimits({ body: { content: "1234" } } as Request, {} as Response, () => assert.fail("next should not be called")));
    });
});
