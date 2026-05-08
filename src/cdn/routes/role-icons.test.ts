import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CdnConfiguration } from "@spacebar/util";
import { assertRoleIconUploadSize, ROLE_ICON_MIME_TYPES } from "./role-icons";

function createCdnConfig() {
    const cdn = new CdnConfiguration();
    cdn.maxAttachmentSize = 25 * 1024 * 1024;
    cdn.limits.roleIcon.maxSize = 512;
    return cdn;
}

describe("role icon CDN policy", () => {
    test("allows only MIME types that can be classified as static from file signatures", () => {
        assert.equal(ROLE_ICON_MIME_TYPES.includes("image/png"), true);
        assert.equal(ROLE_ICON_MIME_TYPES.includes("image/jpeg"), true);
        assert.equal(ROLE_ICON_MIME_TYPES.includes("image/svg+xml"), true);

        assert.equal(ROLE_ICON_MIME_TYPES.includes("image/gif"), false);
        assert.equal(ROLE_ICON_MIME_TYPES.includes("image/apng"), false);
        assert.equal(ROLE_ICON_MIME_TYPES.includes("image/webp"), false);
    });

    test("enforces the configured role icon size limit on direct CDN uploads", () => {
        const cdn = createCdnConfig();

        assert.doesNotThrow(() => assertRoleIconUploadSize("role-id", 512, cdn));
        assert.throws(() => assertRoleIconUploadSize("role-id", 513, cdn), {
            code: 50045,
            message: "File uploaded exceeds the maximum size",
        });
    });
});
