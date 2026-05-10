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
import { describe, test, type TestContext } from "node:test";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import { isNoAuthorizationRoute } from "../../src/api/middlewares/NoAuthorizationRoutes";
import oauthUserInfoRouter, { getOAuthScopeValues, getOAuthUserInfoAuthorization, getOAuthUserInfoPicture, toOAuthUserInfoResponse } from "../../src/api/routes/oauth2/userinfo";
import { Config, DiscordApiErrors, User } from "@spacebar/util";
import express from "express";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/oauth2/userinfo/"];

describe("GET /oauth2/userinfo", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/oauth2/userinfo/"]);
    });

    test("parses OAuth scopes from Discord-compatible token claim shapes", () => {
        assert.deepEqual(getOAuthScopeValues({ scope: "openid identify email" }), ["openid", "identify", "email"]);
        assert.deepEqual(getOAuthScopeValues({ scopes: ["openid", "identify email"], scp: "email,openid" }).sort(), ["email", "identify", "openid"]);
        assert.deepEqual(getOAuthScopeValues({}), []);
    });

    test("treats tokens without persisted scope claims as sub-only", () => {
        assert.deepEqual(getOAuthUserInfoAuthorization({ sub: "user-id", iat: 1 }), {
            hasExplicitScopes: false,
            hasOpenIdScope: false,
            includeEmail: false,
            includeIdentify: false,
        });
    });

    test("requires openid when a token explicitly carries OAuth scopes", () => {
        assert.throws(() => getOAuthUserInfoAuthorization({ scope: "identify email" }), {
            code: DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE.code,
        });
        assert.throws(() => getOAuthUserInfoAuthorization({ scope: "" }), {
            code: DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE.code,
        });

        assert.deepEqual(getOAuthUserInfoAuthorization({ scope: "openid identify email" }), {
            hasExplicitScopes: true,
            hasOpenIdScope: true,
            includeEmail: true,
            includeIdentify: true,
        });
    });

    test("serializes only scope-backed OpenID claims", () => {
        const user = {
            id: "852892297661906993",
            username: "alice",
            avatar: "avatar-hash",
            email: "alice@example.test",
            verified: true,
            settings: {
                locale: "en-GB",
            },
        };

        assert.deepEqual(
            toOAuthUserInfoResponse(user, "https://cdn.example.test/", {
                includeEmail: false,
                includeIdentify: false,
            }),
            {
                sub: "852892297661906993",
            },
        );

        assert.deepEqual(
            toOAuthUserInfoResponse(user, "https://cdn.example.test/", {
                includeEmail: true,
                includeIdentify: true,
            }),
            {
                sub: "852892297661906993",
                email: "alice@example.test",
                email_verified: true,
                preferred_username: "alice",
                nickname: null,
                picture: "https://cdn.example.test/avatars/852892297661906993/avatar-hash.png",
                locale: "en-GB",
            },
        );
    });

    test("returns null email and a deterministic default avatar when local data is absent", () => {
        const response = toOAuthUserInfoResponse(
            {
                id: "14",
                username: "guest",
                avatar: null,
                email: null,
                verified: true,
                settings: null,
            },
            "https://cdn.example.test",
            {
                includeEmail: true,
                includeIdentify: true,
            },
        );

        assert.deepEqual(response, {
            sub: "14",
            email: null,
            email_verified: false,
            preferred_username: "guest",
            nickname: null,
            picture: "https://cdn.example.test/embed/avatars/2.png",
            locale: "en-US",
        });
        assert.equal(getOAuthUserInfoPicture({ id: "not-a-snowflake", avatar: undefined }, "https://cdn.example.test/"), "https://cdn.example.test/embed/avatars/0.png");
    });

    test("scope-less authenticated tokens return sub only and query only the user id", async (t) => {
        const harness = setupOAuthUserInfoRoute(t, {
            token: { sub: "viewer", iat: 1 },
            user: { id: "viewer" },
        });

        const response = await requestJson(harness.app, "/oauth2/userinfo");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            sub: "viewer",
        });
        assert.deepEqual(harness.userFindOptions, [
            {
                where: { id: "viewer" },
                select: { id: true },
            },
        ]);
        assert.equal(harness.configGetCalls, 0);
    });

    test("explicit OAuth tokens without openid fail before user lookup", async (t) => {
        const harness = setupOAuthUserInfoRoute(t, {
            token: { scope: "identify email" },
            user: { id: "viewer" },
        });

        const response = await requestJson(harness.app, "/oauth2/userinfo");

        assert.equal(response.status, 400);
        assert.equal(response.body.code, DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE.code);
        assert.equal(response.body.message, DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE.message);
        assert.deepEqual(harness.userFindOptions, []);
    });

    test("explicit openid tokens return only the claims backed by their scopes", async (t) => {
        const harness = setupOAuthUserInfoRoute(t, {
            token: { scope: "openid identify email" },
            user: {
                id: "viewer",
                username: "viewer-name",
                avatar: null,
                email: "viewer@example.test",
                verified: true,
                settings: {
                    locale: "de",
                },
            },
        });

        const response = await requestJson(harness.app, "/oauth2/userinfo");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            sub: "viewer",
            email: "viewer@example.test",
            email_verified: true,
            preferred_username: "viewer-name",
            nickname: null,
            picture: "https://cdn.example.test/embed/avatars/0.png",
            locale: "de",
        });
        assert.deepEqual(harness.userFindOptions, [
            {
                where: { id: "viewer" },
                select: {
                    id: true,
                    username: true,
                    avatar: true,
                    settings: {
                        locale: true,
                    },
                    email: true,
                    verified: true,
                },
                relations: {
                    settings: true,
                },
            },
        ]);
        assert.equal(harness.configGetCalls, 1);
    });

    test("documents authenticated metadata and OpenID response schema", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "oauth2", "userinfo.ts"), "utf-8");

        assert.equal(isNoAuthorizationRoute("GET", "/oauth2/userinfo"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/oauth2/userinfo"), false);
        assert.match(routeSource, /summary:\s*"Get OpenID User Information"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"OAuthUserInfoResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("generated schemas and OpenAPI document conservative optional claims", () => {
        const schemas = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf-8"));
        const schema = schemas.OAuthUserInfoResponse;

        assert.deepEqual(Object.keys(schema.properties).sort(), ["email", "email_verified", "locale", "nickname", "picture", "preferred_username", "sub"]);
        assert.deepEqual(schema.required, ["sub"]);
        assert.equal(schema.properties.sub.type, "string");
        assert.deepEqual([...schema.properties.email.type].sort(), ["null", "string"]);
        assert.equal(schema.properties.email_verified.type, "boolean");
        assert.deepEqual([...schema.properties.nickname.type].sort(), ["null", "string"]);

        const openapi = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf-8"));
        const userinfo = openapi.paths["/oauth2/userinfo/"].get;
        assert.deepEqual(userinfo.responses["200"].content["application/json"].schema, { $ref: "#/components/schemas/OAuthUserInfoResponse" });
        assert.deepEqual(userinfo.responses["401"].content["application/json"].schema, { $ref: "#/components/schemas/APIErrorResponse" });
    });
});

type TestUser = {
    id: string;
    username?: string;
    avatar?: string | null;
    email?: string | null;
    verified?: boolean;
    settings?: {
        locale?: string | null;
    } | null;
};

function setupOAuthUserInfoRoute(t: TestContext, options: { token: Record<string, unknown>; user: TestUser; userId?: string }) {
    const userFindOptions: unknown[] = [];
    let configGetCalls = 0;

    t.mock.method(User, "findOneOrFail", async (findOptions: unknown) => {
        userFindOptions.push(findOptions);
        return options.user as never;
    });
    t.mock.method(Config, "get", () => {
        configGetCalls++;
        return {
            cdn: {
                endpointPublic: "https://cdn.example.test",
            },
        } as never;
    });

    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        req.token = options.token as never;
        next();
    });
    app.use("/oauth2/userinfo", oauthUserInfoRouter);
    app.use(ErrorHandler);

    return {
        app,
        get configGetCalls() {
            return configGetCalls;
        },
        get userFindOptions() {
            return userFindOptions;
        },
    };
}

async function requestJson(app: express.Express, requestPath: string) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
