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
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";
import express, { type NextFunction, type Request, type Response } from "express";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import { isNoAuthorizationRoute } from "../../src/api/middlewares/NoAuthorizationRoutes";
import invitesRouter, { INVITE_TARGET_USERS_UNSUPPORTED_MESSAGE, assertCanReadInviteTargetUsers, createInviteTargetUsersUnsupportedError } from "../../src/api/routes/invites";
import { DiscordApiErrors, Invite } from "@spacebar/util";

type JsonResponse = {
    status: number;
    body: Record<string, unknown>;
};

const manifestId = "api:http:GET:/invites/:invite_code/target-users";

describe("GET /invites/:invite_code/target-users", () => {
    test("keeps only the base invite lookup public", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/invites/cool-code"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/invites/cool-code"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/invites/cool-code/target-users"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/invites/cool-code/target-users"), false);
    });

    test("declares authenticated fail-closed response metadata", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "invites", "index.ts"), "utf-8");

        assert.match(routeSource, /"\/:invite_code\/target-users"/);
        assert.match(routeSource, /summary:\s*"Get Invite Target Users"/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("uses a typed unsupported error while target-user-file storage is absent", () => {
        const error = createInviteTargetUsersUnsupportedError();

        assert.equal(error.code, 0);
        assert.equal(error.httpStatus, 501);
        assert.equal(error.message, INVITE_TARGET_USERS_UNSUPPORTED_MESSAGE);
    });

    test("lets the inviter reach fail-closed handling without a guild permission lookup", async () => {
        await assert.doesNotReject(() =>
            assertCanReadInviteTargetUsers(
                "requester",
                { channel_id: "channel-1", guild_id: null, inviter_id: "requester" },
                {
                    getPermission: async () => {
                        throw new Error("permission lookup should not run for the inviter");
                    },
                },
            ),
        );
    });

    test("allows non-inviters with MANAGE_GUILD or VIEW_AUDIT_LOG", async () => {
        const calls: Array<[string, string]> = [];

        await assert.doesNotReject(() =>
            assertCanReadInviteTargetUsers(
                "requester",
                { channel_id: "channel-1", guild_id: "guild-1", inviter_id: "creator" },
                {
                    getPermission: async (userId, guildId) => {
                        calls.push([userId, guildId]);
                        return {
                            has: (permission) => permission === "VIEW_AUDIT_LOG",
                        };
                    },
                },
            ),
        );

        assert.deepEqual(calls, [["requester", "guild-1"]]);
    });

    test("rejects non-inviters without a guild permission path or required permission", async () => {
        await assert.rejects(
            () =>
                assertCanReadInviteTargetUsers(
                    "requester",
                    { channel_id: null, guild_id: null, inviter_id: "creator" },
                    {
                        getPermission: async () => {
                            throw new Error("permission lookup should not run without a guild");
                        },
                    },
                ),
            { code: DiscordApiErrors.MISSING_PERMISSIONS.code },
        );

        await assert.rejects(
            () =>
                assertCanReadInviteTargetUsers(
                    "requester",
                    { channel_id: "channel-1", guild_id: "guild-1", inviter_id: "creator" },
                    {
                        getPermission: async () => ({
                            has: () => false,
                        }),
                    },
                ),
            { code: DiscordApiErrors.MISSING_PERMISSIONS.code },
        );
    });

    test("fails closed from the mounted route after invite lookup and authorization", async (t) => {
        const harness = setupInviteTargetUsersMocks(t, {
            invite: { channel_id: "channel-1", guild_id: "guild-1", inviter_id: "requester" },
        });

        const app = appWithInvitesRouter("requester");
        const response = await requestJson(app, "/invites/guild-code/target-users");

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: INVITE_TARGET_USERS_UNSUPPORTED_MESSAGE,
        });
        assert.deepEqual(harness.inviteFindOptions[0], {
            where: { code: "guild-code" },
            select: {
                channel_id: true,
                code: true,
                guild_id: true,
                inviter_id: true,
            },
        });
    });

    test("uses existing invite lookup 404 behavior for unknown invite codes", async (t) => {
        setupInviteTargetUsersMocks(t, {
            inviteError: entityNotFoundError(),
        });

        const app = appWithInvitesRouter("requester");
        const response = await requestJson(app, "/invites/missing-code/target-users");

        assert.equal(response.status, 404);
        assert.equal(response.body.code, 404);
        assert.equal(response.body.message, "Invite could not be found");
    });

    test("is present in regenerated catalogs and manifests as a bearer route", () => {
        const catalog = JSON.parse(
            readFileSync(path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf-8"),
        ) as Array<{
            method: string;
            route: string;
            route_name: string;
            source: string;
            response_schema_refs?: string[];
        }>;
        const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "testing-manifest.json"), "utf-8")) as {
            entries: Array<{
                id: string;
                authMode: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }>;
        };

        assert.deepEqual(
            catalog.find((route) => route.method === "GET" && route.route === "/invites/{invite_code}/target-users"),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse"],
                route: "/invites/{invite_code}/target-users",
                route_name: "GET_INVITES_INVITE_CODE_TARGET_USERS",
                source: "src/api/routes/invites/index.ts",
            },
        );

        const manifestEntry = manifest.entries.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [401, 403, 404, 501]);
    });

    test("documents bearer security and fail-closed schema in OpenAPI", () => {
        const openApi = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf-8")) as {
            paths: Record<
                string,
                {
                    get?: {
                        security?: Array<Record<string, unknown[]>>;
                        responses?: Record<
                            string,
                            {
                                content?: {
                                    "application/json"?: {
                                        schema?: {
                                            $ref?: string;
                                        };
                                    };
                                };
                            }
                        >;
                    };
                }
            >;
        };

        const operation = openApi.paths["/invites/{invite_code}/target-users"]?.get;

        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.responses?.["200"], undefined);
        assert.equal(operation?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
    });
});

function setupInviteTargetUsersMocks(
    t: TestContext,
    options: {
        invite?: { channel_id: string; guild_id: string; inviter_id: string };
        inviteError?: Error;
    },
) {
    const inviteFindOptions: unknown[] = [];

    t.mock.method(Invite, "findOneOrFail", async (findOptions: unknown) => {
        inviteFindOptions.push(findOptions);
        if (options.inviteError) throw options.inviteError;
        return options.invite ?? { channel_id: "channel-1", guild_id: "guild-1", inviter_id: "requester" };
    });

    return {
        inviteFindOptions,
    };
}

function entityNotFoundError() {
    const error = new Error('Could not find any entity of type "Invite" matching the query');
    error.name = "EntityNotFoundError";
    return error;
}

function appWithInvitesRouter(userId: string) {
    const app = express();
    app.use((req: Request, _res: Response, next: NextFunction) => {
        req.user_id = userId;
        next();
    });
    app.use("/invites", invitesRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, url: string): Promise<JsonResponse> {
    const { server, baseUrl } = await listen(app);
    try {
        const response = await fetch(`${baseUrl}${url}`);
        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        await close(server);
    }
}

async function listen(app: express.Express) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    const address = server.address();
    assert(address && typeof address === "object");

    return {
        server,
        baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    };
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
