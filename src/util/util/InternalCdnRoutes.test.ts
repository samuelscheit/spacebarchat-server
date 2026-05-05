import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getCdnMutationUrl, getInternalCdnPath, getInternalCdnUrl, shouldUseInternalCdnPath } from "./InternalCdnRoutes";

describe("internal CDN route helpers", () => {
    test("builds internal CDN paths", () => {
        assert.equal(getInternalCdnPath("/attachments/channel/message"), "/_spacebar/cdn/attachments/channel/message");
        assert.equal(getInternalCdnPath("attachments/channel/message"), "/_spacebar/cdn/attachments/channel/message");
    });

    test("builds internal CDN URLs without duplicate separators", () => {
        assert.equal(getInternalCdnUrl("https://cdn.example/", "/attachments/channel/message"), "https://cdn.example/_spacebar/cdn/attachments/channel/message");
    });

    test("moves attachment mutations to the internal CDN namespace", () => {
        assert.equal(shouldUseInternalCdnPath("/attachments/channel/message"), true);
        assert.equal(getCdnMutationUrl("https://cdn.example", "/attachments/channel/message"), "https://cdn.example/_spacebar/cdn/attachments/channel/message");
    });

    test("leaves non-attachment mutation paths on their existing routes", () => {
        assert.equal(shouldUseInternalCdnPath("/icons/guild"), false);
        assert.equal(getCdnMutationUrl("https://cdn.example", "/icons/guild"), "https://cdn.example/icons/guild");
    });
});
