import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { DiscordApiErrors, type Tag } from "@spacebar/util";
import { requireAvailableTag } from "./ForumTags";

function tag(id: string): Tag {
    return { id } as Tag;
}

function readSource(path: string): string {
    return readFileSync(join(process.cwd(), path), "utf8");
}

describe("forum tag helpers", () => {
    test("returns the requested tag from the channel available tags", () => {
        const expected = tag("tag-2");

        assert.equal(
            requireAvailableTag(
                {
                    available_tags: [tag("tag-1"), expected],
                },
                "tag-2",
            ),
            expected,
        );
    });

    test("throws the typed unknown tag API error when the channel does not contain the tag", () => {
        assert.throws(
            () =>
                requireAvailableTag(
                    {
                        available_tags: [tag("tag-1")],
                    },
                    "tag-2",
                ),
            (error) => error === DiscordApiErrors.UNKNOWN_TAG,
        );
    });

    test("throws the typed unknown tag API error when channel tags were not loaded", () => {
        assert.throws(
            () => requireAvailableTag({}, "tag-2"),
            (error) => error === DiscordApiErrors.UNKNOWN_TAG,
        );
    });

    test("forum tag routes resolve tags through the channel-scoped helper", () => {
        const source = readSource("src/api/routes/channels/#channel_id/tags.ts");

        assert.equal(source.includes("TODO better error"), false);
        assert.equal(source.includes('new HTTPError("Tag not found")'), false);
        assert.equal(source.includes("Tag.findOneByOrFail"), false);
        assert.equal(source.match(/requireAvailableTag\(channel, tag_id\)/g)?.length, 2);
    });
});
