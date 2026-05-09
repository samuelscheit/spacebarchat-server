process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar-test";

import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import express from "express";
import type { Event } from "@spacebar/util";

interface PendingInteractionRecord {
    timeout: NodeJS.Timeout;
    applicationId: string;
    userId: string;
    channelId?: string;
    guildId?: string;
    nonce?: string;
    type: number;
}

interface InteractionSuccessEventPayload extends Event {
    event: "INTERACTION_SUCCESS";
    user_id: string;
    data: {
        id: string;
        nonce?: string;
    };
}

const util = require("@spacebar/util") as typeof import("@spacebar/util");
const pendingInteractions = util.pendingInteractions as Map<string, PendingInteractionRecord>;

function createCallbackApp() {
    const app = express();
    app.use(express.json());

    const callbackModulePath = path.join(process.cwd(), "dist/api/routes/interactions/#interaction_id/#interaction_token/callback.js");
    const callbackRouter = require(callbackModulePath).default as express.Router;
    app.use("/interactions/:interaction_id/:interaction_token/callback", callbackRouter);
    app.use((error: { code?: number | string; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(typeof error.code === "number" ? error.code : 500).json({ code: error.code, message: error.message });
    });

    return app;
}

async function postInteractionCallback(nonce?: string) {
    const interactionId = `interaction-${nonce ?? "without-nonce"}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const userId = `user-${interactionId}`;
    const timeout = setTimeout(() => undefined, 30_000);
    const pendingInteraction: PendingInteractionRecord = {
        timeout,
        applicationId: "application-id",
        userId,
        type: 1,
    };

    if (nonce !== undefined) pendingInteraction.nonce = nonce;
    pendingInteractions.set(interactionId, pendingInteraction);

    const eventPromise = waitForUserEvent(userId);

    try {
        const response = await postJson(createCallbackApp(), `/interactions/${interactionId}/callback-token/callback`, { type: 1, data: {} });
        assert.equal(response.status, 204);
        const event = await eventPromise;
        assert.equal(event.event, "INTERACTION_SUCCESS");
        assert.equal(event.user_id, userId);
        assert.equal(event.data.id, interactionId);
        return event;
    } finally {
        clearTimeout(timeout);
        pendingInteractions.delete(interactionId);
    }
}

async function waitForUserEvent(userId: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);

    try {
        const [event] = (await once(util.events, userId, { signal: controller.signal })) as [InteractionSuccessEventPayload];
        return event;
    } finally {
        clearTimeout(timeout);
    }
}

async function postJson(app: express.Express, requestPath: string, body: object) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        return await fetch(`http://127.0.0.1:${port}${requestPath}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

test("interaction callback success preserves provided nonces", async () => {
    const event = await postInteractionCallback("interaction-nonce");

    assert.equal(event.data.nonce, "interaction-nonce");
});

test("interaction callback success does not synthesize an empty nonce", async () => {
    const event = await postInteractionCallback();

    assert.equal(event.data.nonce, undefined);
    assert.notEqual(event.data.nonce, "");
});
