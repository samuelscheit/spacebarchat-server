import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
    ANIMATED_AVATAR_USER_ID_HEADER,
    getAttachmentCloneMutationPath,
    getAttachmentMutationPath,
    getCdnMutationHeaders,
    getCdnMutationUrl,
    getInternalCdnPath,
    getInternalCdnUrl,
    shouldUseInternalCdnPath,
} from "./InternalCdnRoutes";

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

    test("builds cloud attachment mutation paths for internal CDN calls", () => {
        const uploadFilename = "channel/CLOUD_user_batch/attachment/file.png";

        assert.equal(getAttachmentMutationPath(uploadFilename), "/attachments/channel/CLOUD_user_batch/attachment/file.png");
        assert.equal(getAttachmentCloneMutationPath(uploadFilename, "message"), "/attachments/channel/CLOUD_user_batch/attachment/file.png/clone_to_message/message");
        assert.equal(
            getCdnMutationUrl("https://cdn.example/", getAttachmentCloneMutationPath(uploadFilename, "message")),
            "https://cdn.example/_spacebar/cdn/attachments/channel/CLOUD_user_batch/attachment/file.png/clone_to_message/message",
        );
    });

    test("leaves non-attachment mutation paths on their existing routes", () => {
        assert.equal(shouldUseInternalCdnPath("/icons/guild"), false);
        assert.equal(getCdnMutationUrl("https://cdn.example", "/icons/guild"), "https://cdn.example/icons/guild");
    });

    test("adds animated avatar user context only for user avatar mutations", () => {
        assert.deepEqual(
            getCdnMutationHeaders({
                formHeaders: { "content-type": "multipart/form-data; boundary=test" },
                requestSignature: "signature",
                animatedAvatarUserId: "user-id",
            }),
            {
                "content-type": "multipart/form-data; boundary=test",
                signature: "signature",
                [ANIMATED_AVATAR_USER_ID_HEADER]: "user-id",
            },
        );

        assert.deepEqual(
            getCdnMutationHeaders({
                formHeaders: { "content-type": "multipart/form-data; boundary=test" },
                requestSignature: "signature",
            }),
            {
                "content-type": "multipart/form-data; boundary=test",
                signature: "signature",
            },
        );
    });
});
