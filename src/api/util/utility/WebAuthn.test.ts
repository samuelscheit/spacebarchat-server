import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Request } from "express";
import {
    buildWebAuthnAssertionExpectations,
    buildWebAuthnTicketPayload,
    getWebAuthnExpectedOrigin,
    isWebAuthnCredentialAllowed,
    isWebAuthnTicketForUser,
    parseWebAuthnCredentialResponse,
    webAuthnLoginMfaSecurityKeyLookup,
    webAuthnSecurityKeyLookup,
} from "./WebAuthn";

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

    test("uses Express-trusted protocol and host when no public endpoint is configured", () => {
        const req = request({
            host: "spacebar.example",
            "x-forwarded-proto": "https",
            "x-forwarded-host": "attacker.example",
        });

        assert.equal(getWebAuthnExpectedOrigin(req, null), "http://spacebar.example");
    });

    test("builds user-bound login MFA ticket payloads from server challenge data", () => {
        const req = request({ host: "spacebar.example" }, "https");

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

    test("rejects tickets for another user or WebAuthn purpose", () => {
        const ticketPayload = {
            challenge: "server-challenge",
            origin: "https://spacebar.example",
            rpId: "spacebar.example",
            user_id: "victim-user",
            purpose: "login_mfa" as const,
            allowCredentialIds: ["victim-key"],
        };

        assert.equal(isWebAuthnTicketForUser(ticketPayload, "victim-user", "login_mfa"), true);
        assert.equal(isWebAuthnTicketForUser(ticketPayload, "attacker-user", "login_mfa"), false);
        assert.equal(isWebAuthnTicketForUser(ticketPayload, "victim-user", "credential_registration"), false);
        assert.equal(isWebAuthnTicketForUser({ challenge: "legacy-ticket" }, "victim-user", "login_mfa"), false);
        assert.equal(isWebAuthnTicketForUser({ ...ticketPayload, allowCredentialIds: undefined }, "victim-user", "login_mfa"), false);
    });

    test("checks presented login MFA credentials against the ticket allow-list", () => {
        const ticketPayload = {
            challenge: "server-challenge",
            origin: "https://spacebar.example",
            rpId: "spacebar.example",
            user_id: "victim-user",
            purpose: "login_mfa" as const,
            allowCredentialIds: [Buffer.from("victim-key").toString("base64")],
        };

        assert.equal(isWebAuthnCredentialAllowed(ticketPayload, Buffer.from("victim-key").toString("base64")), true);
        assert.equal(isWebAuthnCredentialAllowed(ticketPayload, Buffer.from("attacker-key").toString("base64")), false);
        assert.equal(isWebAuthnCredentialAllowed({ ...ticketPayload, allowCredentialIds: undefined }, Buffer.from("victim-key").toString("base64")), false);
    });

    test("builds login MFA security-key lookup only for the ticket user and allowed credential", () => {
        const victimKeyId = Buffer.from("victim-key").toString("base64");
        const attackerKeyId = Buffer.from("attacker-key").toString("base64");
        const ticketPayload = {
            challenge: "server-challenge",
            origin: "https://spacebar.example",
            rpId: "spacebar.example",
            user_id: "victim-user",
            purpose: "login_mfa" as const,
            allowCredentialIds: [victimKeyId],
        };

        assert.deepEqual(webAuthnLoginMfaSecurityKeyLookup(ticketPayload, "victim-user", victimKeyId), {
            key_id: victimKeyId,
            user_id: "victim-user",
        });
        assert.equal(webAuthnLoginMfaSecurityKeyLookup(ticketPayload, "victim-user", attackerKeyId), null);
        assert.equal(webAuthnLoginMfaSecurityKeyLookup(ticketPayload, "attacker-user", victimKeyId), null);
        assert.equal(webAuthnLoginMfaSecurityKeyLookup({ ...ticketPayload, purpose: "credential_registration" }, "victim-user", victimKeyId), null);
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

    test("does not widen assertion allow-list to a presented attacker key", () => {
        const victimKeyId = Buffer.from("victim-key").toString("base64");
        const attackerKeyId = Buffer.from("attacker-key").toString("base64");

        const expectations = buildWebAuthnAssertionExpectations(
            {
                challenge: "server-challenge",
                origin: "https://spacebar.example",
                rpId: "spacebar.example",
                user_id: "victim-user",
                purpose: "login_mfa",
                allowCredentialIds: [victimKeyId],
            },
            {
                key_id: attackerKeyId,
                public_key: "attacker-public-key",
                counter: 1,
            },
        );

        assert.equal(expectations.allowCredentials?.length, 1);
        assert.deepEqual(arrayBufferBytes(expectations.allowCredentials![0].id), [...Buffer.from("victim-key")]);
        assert.notDeepEqual(arrayBufferBytes(expectations.allowCredentials![0].id), [...Buffer.from("attacker-key")]);
    });
});
