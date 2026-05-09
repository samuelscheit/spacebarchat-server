import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DiscordApiErrors } from "./Constants";

describe("Discord API error constants", () => {
    test("defines Unknown tag with Discord-compatible code and 404 status", () => {
        assert.equal(DiscordApiErrors.UNKNOWN_TAG.message, "Unknown tag");
        assert.equal(DiscordApiErrors.UNKNOWN_TAG.code, 10087);
        assert.equal(DiscordApiErrors.UNKNOWN_TAG.httpStatus, 404);
    });
});
