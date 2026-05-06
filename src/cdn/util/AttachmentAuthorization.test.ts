import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasValidAttachmentRequestAuthorization } from "./AttachmentAuthorization";

describe("attachment request authorization", () => {
    it("accepts the exact internal request signature", () => {
        assert.equal(
            hasValidAttachmentRequestAuthorization({
                signatureHeader: "secret",
                requestSignature: "secret",
                cdnSignUrls: true,
                fullUrl: "https://cdn.example.test/attachments/channel/message/file.png",
            }),
            true,
        );
    });

    it("rejects incorrect internal request signatures without falling back to URL signing", () => {
        let checkedSignedUrl = false;

        assert.equal(
            hasValidAttachmentRequestAuthorization({
                signatureHeader: "wrong",
                requestSignature: "secret",
                cdnSignUrls: false,
                fullUrl: "https://cdn.example.test/attachments/channel/message/file.png",
                validateSignature: () => {
                    checkedSignedUrl = true;
                    return true;
                },
            }),
            false,
        );
        assert.equal(checkedSignedUrl, false);
    });

    it("allows unsigned attachment requests only when CDN URL signing is disabled", () => {
        assert.equal(
            hasValidAttachmentRequestAuthorization({
                signatureHeader: undefined,
                requestSignature: "secret",
                cdnSignUrls: false,
                fullUrl: "https://cdn.example.test/attachments/channel/message/file.png",
            }),
            true,
        );
    });

    it("fails closed when signed URL parameters are missing or invalid", () => {
        assert.equal(
            hasValidAttachmentRequestAuthorization({
                signatureHeader: undefined,
                requestSignature: "secret",
                cdnSignUrls: true,
                fullUrl: "https://cdn.example.test/attachments/channel/message/file.png",
                validateSignature: () => true,
            }),
            false,
        );
    });

    it("accepts valid signed URL parameters", () => {
        assert.equal(
            hasValidAttachmentRequestAuthorization({
                signatureHeader: undefined,
                requestSignature: "secret",
                cdnSignUrls: true,
                fullUrl: "https://cdn.example.test/attachments/channel/message/file.png?ex=1&is=1&hm=abc",
                validateSignature: (_request, signature) => signature.path === "/attachments/channel/message/file.png",
            }),
            true,
        );
    });
});
