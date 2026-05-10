/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, test } from "node:test";
import { ErrorHandler } from "@spacebar/api";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import gameInviteMeRouter, {
    GAME_INVITES_UNSUPPORTED_MESSAGE,
    XBOX_GAME_INVITE_APPLICATION_ID,
    assertValidGameInviteInviteId,
    assertXboxGameInviteOAuthToken,
    getGameInviteApplicationId,
} from "../../src/api/routes/game-invite/@me";

const coveredManifestIds = ["api:http:DELETE:/game-invite/@me/", "api:http:DELETE:/game-invite/@me/:game_invite_invite_id", "api:http:POST:/game-invite/@me/"];

describe("/game-invite/@me", () => {
    test("declares the game invite manifest route ids covered by this suite", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:DELETE:/game-invite/@me/", "api:http:DELETE:/game-invite/@me/:game_invite_invite_id", "api:http:POST:/game-invite/@me/"]);
    });

    test("extracts the Xbox OAuth application id from supported token shapes", () => {
        assert.equal(getGameInviteApplicationId({ application_id: XBOX_GAME_INVITE_APPLICATION_ID }), XBOX_GAME_INVITE_APPLICATION_ID);
        assert.equal(getGameInviteApplicationId({ client_id: XBOX_GAME_INVITE_APPLICATION_ID }), XBOX_GAME_INVITE_APPLICATION_ID);
        assert.equal(getGameInviteApplicationId({ application: { id: XBOX_GAME_INVITE_APPLICATION_ID } }), XBOX_GAME_INVITE_APPLICATION_ID);
        assert.equal(getGameInviteApplicationId({ azp: XBOX_GAME_INVITE_APPLICATION_ID }), XBOX_GAME_INVITE_APPLICATION_ID);
        assert.equal(getGameInviteApplicationId({ aud: XBOX_GAME_INVITE_APPLICATION_ID }), XBOX_GAME_INVITE_APPLICATION_ID);
        assert.equal(getGameInviteApplicationId({ application_id: "" }), undefined);
    });

    test("rejects non-Xbox OAuth applications before unsupported game-invite behavior", async () => {
        const app = setupGameInviteRoute({ token: { application_id: "not-the-xbox-app" } });
        const response = await requestJson(app, "/game-invite/@me", {
            method: "POST",
            body: validGameInviteCreateBody(),
        });

        assert.equal(response.status, 400);
        assert.equal(response.body.code, DiscordApiErrors.INVALID_OAUTH_TOKEN.code);
        assert.equal(response.body.message, DiscordApiErrors.INVALID_OAUTH_TOKEN.message);
    });

    test("validates create request bodies using the source-backed fields before fail-closed handling", async () => {
        const app = setupGameInviteRoute();
        const response = await requestJson(app, "/game-invite/@me", {
            method: "POST",
            body: {
                recipient_id: "100000000000000001",
                launch_parameters: "{}",
                application_asset: "https://cdn.example/icon.png",
                application_name: "M",
                ttl: 299,
            },
        });

        assert.equal(response.status, 400);
        assert.equal(response.body.code, 50035);
        assert.equal(response.body.message, "Invalid Form Body");
        assert.equal(typeof response.body.errors, "object");
    });

    test("fails closed for Xbox create requests because game-invite state is unsupported", async () => {
        const app = setupGameInviteRoute();
        const response = await requestJson(app, "/game-invite/@me", {
            method: "POST",
            body: validGameInviteCreateBody(),
        });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: GAME_INVITES_UNSUPPORTED_MESSAGE,
        });
    });

    test("fails closed for Xbox delete-all requests because persisted invites are unsupported", async () => {
        const app = setupGameInviteRoute();
        const response = await requestJson(app, "/game-invite/@me", { method: "DELETE" });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: GAME_INVITES_UNSUPPORTED_MESSAGE,
        });
    });

    test("rejects malformed game invite IDs before unsupported invite deletion", async () => {
        const app = setupGameInviteRoute();
        const response = await requestJson(app, "/game-invite/@me/not-a-snowflake", { method: "DELETE" });

        assert.equal(response.status, 400);
        assert.equal(response.body.code, DiscordApiErrors.INVALID_FORM_BODY.code);
    });

    test("rejects non-Xbox OAuth applications before single invite unsupported behavior", async () => {
        const app = setupGameInviteRoute({ token: { application_id: "not-the-xbox-app" } });
        const response = await requestJson(app, "/game-invite/@me/1387169389857607774", { method: "DELETE" });

        assert.equal(response.status, 400);
        assert.equal(response.body.code, DiscordApiErrors.INVALID_OAUTH_TOKEN.code);
        assert.equal(response.body.message, DiscordApiErrors.INVALID_OAUTH_TOKEN.message);
    });

    test("fails closed for Xbox single invite delete requests because persisted invites are unsupported", async () => {
        const app = setupGameInviteRoute();
        const response = await requestJson(app, "/game-invite/@me/1387169389857607774", { method: "DELETE" });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: GAME_INVITES_UNSUPPORTED_MESSAGE,
        });
    });

    test("documents route metadata for collection and single-invite compatibility handlers", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "game-invite", "@me.ts"), "utf-8");

        assert.match(routeSource, /summary:\s*"Create Game Invite"/);
        assert.match(routeSource, /summary:\s*"Delete Game Invites"/);
        assert.match(routeSource, /summary:\s*"Delete Game Invite"/);
        assert.match(routeSource, /requestBody:\s*"GameInviteCreateSchema"/);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /204:\s*\{/);
        assert.match(routeSource, /\/:game_invite_invite_id/);
    });

    test("uses the shared Discord API error for non-Xbox OAuth tokens", () => {
        assert.throws(() => assertXboxGameInviteOAuthToken({ application_id: "other" }), {
            code: DiscordApiErrors.INVALID_OAUTH_TOKEN.code,
        });
        assert.doesNotThrow(() => assertXboxGameInviteOAuthToken({ application_id: XBOX_GAME_INVITE_APPLICATION_ID }));
    });

    test("validates game invite route IDs as documented snowflakes", () => {
        assert.doesNotThrow(() => assertValidGameInviteInviteId("1387169389857607774"));
        assert.throws(() => assertValidGameInviteInviteId("not-a-snowflake"), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
        assert.throws(() => assertValidGameInviteInviteId("123"), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
    });
});

function setupGameInviteRoute(options: { token?: Record<string, unknown> } = {}) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        req.token = (options.token ?? { application_id: XBOX_GAME_INVITE_APPLICATION_ID }) as never;
        next();
    });
    app.use("/game-invite/@me", gameInviteMeRouter);
    app.use(ErrorHandler);
    return app;
}

function validGameInviteCreateBody() {
    return {
        recipient_id: "100000000000000001",
        launch_parameters: '{"titleId":1750797354,"inviteToken":"token"}',
        application_asset: "https://cdn.example/icon.png",
        application_name: "Minecraft",
        fallback_url: null,
        ttl: 900,
    };
}

async function requestJson(app: express.Express, requestPath: string, options: { method?: string; body?: unknown } = {}) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: options.method,
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers: options.body == undefined ? undefined : { "content-type": "application/json" },
        });

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        await closeServer(server);
    }
}

async function closeServer(server: ReturnType<express.Express["listen"]>) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
