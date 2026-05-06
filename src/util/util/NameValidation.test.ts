import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

let ValidateWebhookName: (name: string, blockedNameRegexPatterns?: string[]) => string;

function isHttpError(error: unknown, code: number, message: string): error is Error & { code?: number } {
    return error instanceof Error && error.message === message && (error as { code?: number }).code === code;
}

describe("ValidateWebhookName", () => {
    before(async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";
        ({ ValidateWebhookName } = await import("./NameValidation.js"));
    });

    test("allows and returns normalized webhook names", () => {
        assert.equal(ValidateWebhookName(" Build Alerts\u200b ", ["^official$"]), "Build Alerts");
    });

    test("rejects normalized webhook names matching configured regex patterns", () => {
        assert.throws(
            () => ValidateWebhookName("Official\u200b", ["^official$"]),
            (error) => isHttpError(error, 400, "Webhook name is blocked"),
        );
    });

    test("does not expose the matched webhook name regex pattern to clients", () => {
        assert.throws(
            () => ValidateWebhookName("Official", ["^official$"]),
            (error) => isHttpError(error, 400, "Webhook name is blocked") && !error.message.includes("^official$"),
        );
    });

    test("rejects invalid webhook name regex configuration", () => {
        assert.throws(
            () => ValidateWebhookName("Build Alerts", ["["]),
            (error) => error instanceof Error && error.message === 'Invalid webhook name blacklist regex "["' && (error as { code?: number }).code === 500,
        );
    });
});
