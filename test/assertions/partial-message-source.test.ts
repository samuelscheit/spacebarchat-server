import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("PartialMessage uses the active interface without the stale legacy Pick sketch", () => {
    const messageSource = readFileSync(path.join(process.cwd(), "src/schemas/api/messages/Message.ts"), "utf8");

    assert.match(messageSource, /export interface PartialMessage\s*\{\s*id: Snowflake;\s*channel_id: string;/);
    assert.doesNotMatch(messageSource, /export type PartialMessage\s*=\s*Pick<Message,\s*"id">/);
    assert.doesNotMatch(messageSource, /Pick<Message,\s*"recipient_id">\s*\/\/\s*TODO: ephemeral DM channels/);
});
