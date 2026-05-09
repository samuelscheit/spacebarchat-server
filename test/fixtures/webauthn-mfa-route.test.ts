import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, test } from "node:test";
import express from "express";
import { User, WebAuthn } from "@spacebar/util";
import webAuthnMfaRouter from "../../src/api/routes/auth/mfa/webauthn";

interface UserStaticsPatch {
    findOneOrFail(options: unknown): Promise<unknown>;
}

function createApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/", webAuthnMfaRouter);
    app.use((error: { code?: number | string; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(500).json({ code: error.code, message: error.message });
    });

    return app;
}

async function postJson(app: express.Express, body: object) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}/`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
        const json = (await response.json()) as { message?: string };

        return { response, json };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

const userStatics = User as unknown as UserStaticsPatch;
const originalFido2 = WebAuthn.fido2;
const originalUserFindOneOrFail = userStatics.findOneOrFail;

afterEach(() => {
    WebAuthn.fido2 = originalFido2;
    userStatics.findOneOrFail = originalUserFindOneOrFail;
});

test("WebAuthn MFA route rejects before loading ticket data when WebAuthn is disabled", async () => {
    const userFindCalls: unknown[] = [];
    WebAuthn.fido2 = null;
    userStatics.findOneOrFail = async (options: unknown) => {
        userFindCalls.push(options);
        throw new Error("unexpected user lookup");
    };

    const { response, json } = await postJson(createApp(), {
        code: "unused-credential",
        ticket: "unused-ticket",
    });

    assert.equal(response.status, 500);
    assert.equal(json.message, "WebAuthn not enabled");
    assert.deepEqual(userFindCalls, []);
});
