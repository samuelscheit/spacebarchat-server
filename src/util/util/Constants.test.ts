import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { DiscordApiErrors } from "./Constants";

function readSource(path: string): string {
    return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Discord API error constants", () => {
    test("defines Unknown tag with Discord-compatible code and 404 status", () => {
        assert.equal(DiscordApiErrors.UNKNOWN_TAG.message, "Unknown tag");
        assert.equal(DiscordApiErrors.UNKNOWN_TAG.code, 10087);
        assert.equal(DiscordApiErrors.UNKNOWN_TAG.httpStatus, 404);
    });

    test("forum tag update route uses the typed Unknown tag error", () => {
        const source = readSource("src/api/routes/channels/#channel_id/tags.ts");

        assert.equal(source.includes("TODO better error"), false);
        assert.equal(source.includes('new HTTPError("Tag not found")'), false);
        assert.ok(source.includes("if (!tag) throw DiscordApiErrors.UNKNOWN_TAG;"));
    });
});
