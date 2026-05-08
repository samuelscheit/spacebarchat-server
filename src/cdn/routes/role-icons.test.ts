import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ROLE_ICON_MIME_TYPES } from "./role-icons";

describe("role icon CDN policy", () => {
    test("allows only MIME types that can be classified as static from file signatures", () => {
        assert.equal(ROLE_ICON_MIME_TYPES.includes("image/png"), true);
        assert.equal(ROLE_ICON_MIME_TYPES.includes("image/jpeg"), true);
        assert.equal(ROLE_ICON_MIME_TYPES.includes("image/svg+xml"), true);

        assert.equal(ROLE_ICON_MIME_TYPES.includes("image/gif"), false);
        assert.equal(ROLE_ICON_MIME_TYPES.includes("image/apng"), false);
        assert.equal(ROLE_ICON_MIME_TYPES.includes("image/webp"), false);
    });
});
