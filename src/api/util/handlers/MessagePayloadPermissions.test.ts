import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { assertMessagePayloadPermissions } from "../utility/MessagePayloadPermissions";

function permissions(...allowed: ("EMBED_LINKS" | "ATTACH_FILES")[]) {
    return {
        hasThrow(permission: "EMBED_LINKS" | "ATTACH_FILES") {
            if (allowed.includes(permission)) return;
            throw new Error(`You are missing the following permissions ${permission}`);
        },
    };
}

describe("assertMessagePayloadPermissions", () => {
    test("allows plain content without media permissions", () => {
        assert.doesNotThrow(() => {
            assertMessagePayloadPermissions(permissions(), {});
        });
    });

    test("requires EMBED_LINKS for explicit embeds", () => {
        assert.throws(() => {
            assertMessagePayloadPermissions(permissions(), {
                embeds: [{ title: "blocked" }],
            });
        }, /EMBED_LINKS/);

        assert.doesNotThrow(() => {
            assertMessagePayloadPermissions(permissions("EMBED_LINKS"), {
                embeds: [{ title: "allowed" }],
            });
        });
    });

    test("requires EMBED_LINKS for deprecated single embed payloads", () => {
        assert.throws(() => {
            assertMessagePayloadPermissions(permissions(), {
                embed: { title: "blocked" },
            });
        }, /EMBED_LINKS/);
    });

    test("requires ATTACH_FILES for cloud attachment payloads", () => {
        assert.throws(() => {
            assertMessagePayloadPermissions(permissions(), {
                attachments: [{ id: "0", filename: "image.png", uploaded_filename: "upload/image.png" }],
            });
        }, /ATTACH_FILES/);

        assert.doesNotThrow(() => {
            assertMessagePayloadPermissions(permissions("ATTACH_FILES"), {
                attachments: [{ id: "0", filename: "image.png", uploaded_filename: "upload/image.png" }],
            });
        });
    });

    test("allows retained attachment references without ATTACH_FILES", () => {
        assert.doesNotThrow(() => {
            assertMessagePayloadPermissions(permissions(), {
                attachments: [{ id: "123", filename: "existing.png" }],
            });
        });
    });

    test("requires ATTACH_FILES when retained and new cloud attachments are mixed", () => {
        assert.throws(() => {
            assertMessagePayloadPermissions(permissions(), {
                attachments: [
                    { id: "123", filename: "existing.png" },
                    { id: "0", filename: "new.png", uploaded_filename: "upload/new.png" },
                ],
            });
        }, /ATTACH_FILES/);
    });

    test("requires ATTACH_FILES for multipart uploads", () => {
        assert.throws(() => {
            assertMessagePayloadPermissions(permissions(), {
                uploadedFileCount: 1,
            });
        }, /ATTACH_FILES/);
    });

    test("allows clearing attachments without ATTACH_FILES", () => {
        assert.doesNotThrow(() => {
            assertMessagePayloadPermissions(permissions(), {
                attachments: [],
            });
        });
    });
});
