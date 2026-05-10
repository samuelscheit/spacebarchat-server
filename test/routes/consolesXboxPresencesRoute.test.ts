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
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";
import express from "express";
import { ConnectedAccount, DiscordApiErrors, Relationship, Session } from "@spacebar/util";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import xboxPresencesRouter, {
    XBOX_PRESENCES_APPLICATION_ID,
    assertXboxPresencesOAuthToken,
    getXboxPresencesApplicationId,
    hasXboxPresencesOAuthScope,
} from "../../src/api/routes/consoles/xbox/presences";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/consoles/xbox/presences/"];

describe("GET /consoles/xbox/presences", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/consoles/xbox/presences/"]);
    });

    test("parses OAuth scope and Xbox application id from supported token shapes", () => {
        assert.equal(hasXboxPresencesOAuthScope({ scope: "identify activities.read" }), true);
        assert.equal(hasXboxPresencesOAuthScope({ scopes: ["identify", "activities.read"] }), true);
        assert.equal(hasXboxPresencesOAuthScope({ scp: "identify,activities.read" }), true);
        assert.equal(hasXboxPresencesOAuthScope({ scope: "identify" }), false);

        assert.equal(getXboxPresencesApplicationId({ application_id: XBOX_PRESENCES_APPLICATION_ID }), XBOX_PRESENCES_APPLICATION_ID);
        assert.equal(getXboxPresencesApplicationId({ application: { id: XBOX_PRESENCES_APPLICATION_ID } }), XBOX_PRESENCES_APPLICATION_ID);
    });

    test("rejects tokens without the activities.read OAuth scope before database lookup", async (t) => {
        const harness = setupXboxPresencesRoute(t, {
            token: { scope: "identify", application_id: XBOX_PRESENCES_APPLICATION_ID },
        });

        const response = await requestJson(harness.app, "/consoles/xbox/presences");

        assert.equal(response.status, 400);
        assert.equal(response.body.code, DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE.code);
        assert.equal(harness.relationshipFindOptions.length, 0);
        assert.equal(harness.sessionFindOptions.length, 0);
        assert.equal(harness.connectedAccountFindOptions.length, 0);
    });

    test("rejects non-Xbox OAuth applications before database lookup", async (t) => {
        const harness = setupXboxPresencesRoute(t, {
            token: { scope: "activities.read", application_id: "not-the-xbox-app" },
        });

        const response = await requestJson(harness.app, "/consoles/xbox/presences");

        assert.equal(response.status, 400);
        assert.equal(response.body.code, DiscordApiErrors.INVALID_OAUTH_TOKEN.code);
        assert.equal(harness.relationshipFindOptions.length, 0);
        assert.equal(harness.sessionFindOptions.length, 0);
        assert.equal(harness.connectedAccountFindOptions.length, 0);
    });

    test("returns only locally backed non-offline friend presences with visible Xbox account ids", async (t) => {
        const harness = setupXboxPresencesRoute(t, {
            relationships: [relationship("active-friend", "active"), relationship("offline-friend", "offline"), relationship("quiet-friend", "quiet")],
            sessions: [
                {
                    user_id: "active-friend",
                    status: "online",
                    activities: [{ name: "Rocket League", type: 0, platform: "xbox", application_id: "379286085710381999" }],
                    client_status: { embedded: "online" },
                },
                {
                    user_id: "offline-friend",
                    status: "offline",
                    activities: [{ name: "Hidden Game", type: 0 }],
                    client_status: {},
                },
                {
                    user_id: "quiet-friend",
                    status: "idle",
                    activities: [],
                    client_status: { web: "idle" },
                },
            ],
            accounts: [
                { user_id: "active-friend", external_id: "xuid-b" },
                { user_id: "active-friend", external_id: "xuid-a" },
                { user_id: "quiet-friend", external_id: "quiet-xuid" },
            ],
        });

        const response = await requestJson(harness.app, "/consoles/xbox/presences");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            guilds: [],
            presences: [
                {
                    user: {
                        id: "active-friend",
                        username: "active",
                        discriminator: "0001",
                        avatar: null,
                        public_flags: 0,
                    },
                    status: "online",
                    activities: [{ name: "Rocket League", type: 0, platform: "xbox", application_id: "379286085710381999" }],
                    client_status: { embedded: "online" },
                },
            ],
            applications: [],
            connected_account_ids: [{ user_id: "active-friend", provider_ids: ["xuid-a", "xuid-b"] }],
        });

        assert.equal(harness.relationshipFindOptions.length, 1);
        assert.equal(harness.sessionFindOptions.length, 1);
        assert.equal(harness.connectedAccountFindOptions.length, 1);
    });

    test("documents response schemas and bearer-auth error metadata", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "consoles", "xbox", "presences.ts"), "utf-8");

        assert.match(routeSource, /summary:\s*"Get Presences for Xbox"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"XboxPresencesResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("uses the shared Discord API errors for OAuth failures", () => {
        assert.throws(() => assertXboxPresencesOAuthToken({ scope: "identify", application_id: XBOX_PRESENCES_APPLICATION_ID }), {
            code: DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE.code,
        });
        assert.throws(() => assertXboxPresencesOAuthToken({ scope: "activities.read", application_id: "other" }), {
            code: DiscordApiErrors.INVALID_OAUTH_TOKEN.code,
        });
    });
});

type TestRelationship = {
    to_id: string;
    to: {
        toPublicUser(): {
            id: string;
            username: string;
            discriminator: string;
            avatar: null;
            public_flags: number;
        };
    };
};

type TestSession = {
    user_id: string;
    status: "idle" | "dnd" | "online" | "offline" | "invisible" | "unknown";
    activities: Record<string, unknown>[];
    client_status: Record<string, string>;
};

type TestAccount = {
    user_id: string;
    external_id: string;
};

type SetupOptions = {
    accounts?: TestAccount[];
    relationships?: TestRelationship[];
    sessions?: TestSession[];
    token?: Record<string, unknown>;
    userId?: string;
};

function relationship(id: string, username: string): TestRelationship {
    return {
        to_id: id,
        to: {
            toPublicUser: () => ({
                id,
                username,
                discriminator: "0001",
                avatar: null,
                public_flags: 0,
            }),
        },
    };
}

function setupXboxPresencesRoute(t: TestContext, options: SetupOptions) {
    const relationshipFindOptions: unknown[] = [];
    const sessionFindOptions: unknown[] = [];
    const connectedAccountFindOptions: unknown[] = [];

    t.mock.method(Relationship, "find", async (findOptions: unknown) => {
        relationshipFindOptions.push(findOptions);
        return (options.relationships ?? []) as never;
    });
    t.mock.method(Session, "find", async (findOptions: unknown) => {
        sessionFindOptions.push(findOptions);
        return (options.sessions ?? []) as never;
    });
    t.mock.method(ConnectedAccount, "find", async (findOptions: unknown) => {
        connectedAccountFindOptions.push(findOptions);
        return (options.accounts ?? []) as never;
    });

    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        req.token = (options.token ?? { scope: "identify activities.read", application_id: XBOX_PRESENCES_APPLICATION_ID }) as never;
        next();
    });
    app.use("/consoles/xbox/presences", xboxPresencesRouter);
    app.use(ErrorHandler);

    return {
        app,
        get relationshipFindOptions() {
            return relationshipFindOptions;
        },
        get sessionFindOptions() {
            return sessionFindOptions;
        },
        get connectedAccountFindOptions() {
            return connectedAccountFindOptions;
        },
    };
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        server.close();
    }
}
