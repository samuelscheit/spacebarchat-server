import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Request } from "express";
import { buildWebAuthnAssertionExpectations, buildWebAuthnTicketPayload, getWebAuthnExpectedOrigin, parseWebAuthnCredentialResponse, webAuthnSecurityKeyLookup } from "./WebAuthn";

function request(headers: Record<string, string>, protocol = "http") {
    return {
        headers,
        protocol,
        hostname: "internal.local",
        get(name: string) {
            return headers[name.toLowerCase()];
        },
    } as unknown as Request;
}

function arrayBufferBytes(value: ArrayBuffer) {
    return [...new Uint8Array(value)];
}

describe("WebAuthn API helpers", () => {
    test("uses configured public endpoint as the server-owned WebAuthn origin", () => {
        const req = request({
            origin: "https://attacker.example",
            host: "internal.local",
            "x-forwarded-proto": "https",
            "x-forwarded-host": "forwarded.example",
        });

        assert.equal(getWebAuthnExpectedOrigin(req, "https://spacebar.example/api"), "https://spacebar.example");
    });

    test("builds user-bound login MFA ticket payloads from server challenge data", () => {
        const req = request({
            host: "spacebar.example",
            "x-forwarded-proto": "https",
        });

        const payload = buildWebAuthnTicketPayload(req, Buffer.from([1, 2, 3]), "victim-user", "login_mfa", null, ["YXR0YWNrZXIta2V5"]);

        assert.deepEqual(payload, {
            challenge: "AQID",
            origin: "https://spacebar.example",
            rpId: "spacebar.example",
            user_id: "victim-user",
            purpose: "login_mfa",
            allowCredentialIds: ["YXR0YWNrZXIta2V5"],
        });
    });

    test("scopes security-key lookup to the MFA ticket user", () => {
        assert.deepEqual(webAuthnSecurityKeyLookup("victim-user", "attacker-key"), {
            key_id: "attacker-key",
            user_id: "victim-user",
        });
    });

    test("parses credential rawId into the stored key id format", () => {
        const parsed = parseWebAuthnCredentialResponse(
            JSON.stringify({
                rawId: Buffer.from("key-id").toString("base64url"),
                response: {},
            }),
        );

        assert.ok(parsed);
        assert.equal(parsed.keyId, Buffer.from("key-id").toString("base64"));
        assert.deepEqual(arrayBufferBytes(parsed.credential.rawId), [...Buffer.from("key-id")]);
    });

    test("builds assertion expectations from signed ticket data and scoped key", () => {
        const expectations = buildWebAuthnAssertionExpectations(
            {
                challenge: "server-challenge",
                origin: "https://spacebar.example",
                rpId: "spacebar.example",
                user_id: "victim-user",
                purpose: "login_mfa",
                allowCredentialIds: [Buffer.from("victim-key").toString("base64")],
            },
            {
                key_id: Buffer.from("victim-key").toString("base64"),
                public_key: "public-key",
                counter: 7,
            },
        );

        assert.equal(expectations.challenge, "server-challenge");
        assert.equal(expectations.origin, "https://spacebar.example");
        assert.equal(expectations.rpId, "spacebar.example");
        assert.equal(expectations.publicKey, "public-key");
        assert.equal(expectations.prevCounter, 7);
        assert.equal(expectations.userHandle, null);
        assert.equal(expectations.allowCredentials?.[0].type, "public-key");
        assert.deepEqual(arrayBufferBytes(expectations.allowCredentials![0].id), [...Buffer.from("victim-key")]);
    });
});
