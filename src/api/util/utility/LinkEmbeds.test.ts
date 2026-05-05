import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { selectLinkEmbedUrls } from "./LinkEmbeds";

describe("selectLinkEmbedUrls", () => {
    test("defaults can select the first five unique unsuppressed links", () => {
        const content = ["https://a.com/1", "https://b.com/2", "<https://suppressed.com/skip>", "https://c.com/3", "https://d.com/4", "https://e.com/5", "https://f.com/6"].join(
            " ",
        );

        assert.deepEqual(selectLinkEmbedUrls(content, 5), ["https://a.com/1", "https://b.com/2", "https://c.com/3", "https://d.com/4", "https://e.com/5"]);
    });

    test("honors lower custom limits", () => {
        assert.deepEqual(selectLinkEmbedUrls("https://a.com https://b.com https://c.com", 2), ["https://a.com", "https://b.com"]);
    });

    test("zero disables automatic link embeds", () => {
        assert.deepEqual(selectLinkEmbedUrls("https://a.com https://b.com", 0), []);
    });

    test("deduplicates normalized URLs before counting toward the limit", () => {
        const content = "https://a.com/path/?b=2&a=1#fragment https://a.com/path?a=1&b=2 https://b.com";

        assert.deepEqual(selectLinkEmbedUrls(content, 2), ["https://a.com/path/?b=2&a=1#fragment", "https://b.com"]);
    });

    test("ignores links inside inline code blocks", () => {
        assert.deepEqual(selectLinkEmbedUrls("`https://a.com` https://b.com", 5), ["https://b.com"]);
    });
});
