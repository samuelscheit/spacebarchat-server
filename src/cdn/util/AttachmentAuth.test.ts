import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { hasMatchingRequestSignature, hasValidAttachmentRequestAuth, validateAttachmentSignedUrl } from "./AttachmentAuth";

describe("CDN attachment request authentication", () => {
    test("matches internal request signatures exactly", () => {
        assert.equal(hasMatchingRequestSignature("shared-secret", "shared-secret"), true);
        assert.equal(hasMatchingRequestSignature("wrong-secret", "shared-secret"), false);
        assert.equal(hasMatchingRequestSignature(["shared-secret"], "shared-secret"), false);
        assert.equal(hasMatchingRequestSignature("", "shared-secret"), false);
    });

    test("rejects an incorrect signature header when URL signature validation fails", () => {
        let signedUrlValidatorCalled = false;

        const valid = hasValidAttachmentRequestAuth({
            signatureHeader: "wrong-secret",
            requestSignature: "shared-secret",
            cdnSignUrls: true,
            fullUrl: "https://cdn.example.test/attachments/1/2/file.png",
            validateSignedUrl: () => {
                signedUrlValidatorCalled = true;
                return false;
            },
        });

        assert.equal(valid, false);
        assert.equal(signedUrlValidatorCalled, true);
    });

    test("falls back to signed URL validation for unrelated signature headers", () => {
        const valid = hasValidAttachmentRequestAuth({
            signatureHeader: "unrelated-proxy-signature",
            requestSignature: "shared-secret",
            cdnSignUrls: true,
            fullUrl: "https://cdn.example.test/attachments/1/2/file.png?ex=1&is=1&hm=abc",
            validateSignedUrl: () => true,
        });

        assert.equal(valid, true);
    });

    test("accepts the exact internal request signature", () => {
        const valid = hasValidAttachmentRequestAuth({
            signatureHeader: "shared-secret",
            requestSignature: "shared-secret",
            cdnSignUrls: true,
            fullUrl: "https://cdn.example.test/attachments/1/2/file.png",
            validateSignedUrl: () => false,
        });

        assert.equal(valid, true);
    });

    test("allows unsigned public attachment reads only when URL signing is disabled", () => {
        assert.equal(
            hasValidAttachmentRequestAuth({
                signatureHeader: undefined,
                requestSignature: "shared-secret",
                cdnSignUrls: false,
                fullUrl: "https://cdn.example.test/attachments/1/2/file.png",
                validateSignedUrl: () => false,
            }),
            true,
        );
    });

    test("requires signed URL validation when signing is enabled and no internal signature is present", () => {
        let signedUrlValidatorCalled = false;

        const valid = hasValidAttachmentRequestAuth({
            signatureHeader: undefined,
            requestSignature: "shared-secret",
            cdnSignUrls: true,
            fullUrl: "https://cdn.example.test/attachments/1/2/file.png?ex=1&is=1&hm=abc",
            validateSignedUrl: (auth) => {
                signedUrlValidatorCalled = true;
                assert.equal(auth.fullUrl, "https://cdn.example.test/attachments/1/2/file.png?ex=1&is=1&hm=abc");
                return true;
            },
        });

        assert.equal(valid, true);
        assert.equal(signedUrlValidatorCalled, true);
    });

    test("treats malformed signed attachment URLs as invalid", () => {
        assert.equal(
            validateAttachmentSignedUrl({
                fullUrl: "https://cdn.example.test/attachments/1/2/file.png",
                ip: "127.0.0.1",
                userAgent: "test",
            }),
            false,
        );
    });

    test("denies malformed URLs when signed URL auth is required", () => {
        assert.equal(
            hasValidAttachmentRequestAuth({
                signatureHeader: undefined,
                requestSignature: "shared-secret",
                cdnSignUrls: true,
                fullUrl: "not a url",
            }),
            false,
        );
    });
});
