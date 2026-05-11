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
import { RelationshipType } from "../../src/schemas";
import { validateSchema } from "../../src/schemas/Validator";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import { isNoAuthorizationRoute } from "../../src/api/middlewares/NoAuthorizationRoutes";
import invitesRouter, { buildInviteFriendMembersResponse } from "../../src/api/routes/invites";
import { Invite, Member, Relationship } from "@spacebar/util";

type JsonResponse = {
    status: number;
    body: Record<string, unknown>;
};

const manifestId = "api:http:GET:/invites/:invite_code/friend-members";

describe("GET /invites/:invite_code/friend-members", () => {
    test("keeps only the base invite lookup public", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/invites/cool-code"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/invites/cool-code"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/invites/cool-code/friend-members"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/invites/cool-code/friend-members"), false);
    });

    test("declares authenticated response and error metadata", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "invites", "index.ts"), "utf-8");

        assert.match(routeSource, /"\/:invite_code\/friend-members"/);
        assert.match(routeSource, /summary:\s*"Get Invite Friend Members"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"InviteFriendMembersResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("validates the documented response body shape", () => {
        const payload = { friend_member_ids: ["100000000000000001", "100000000000000002"] };
        const schemas = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf-8")) as Record<
            string,
            { additionalProperties?: boolean; required?: string[] }
        >;

        assert.deepEqual(validateSchema("InviteFriendMembersResponse", payload), payload);
        assert.equal(schemas.InviteFriendMembersResponse.additionalProperties, false);
        assert.deepEqual(schemas.InviteFriendMembersResponse.required, ["friend_member_ids"]);
    });

    test("returns an empty friend_member_ids array for non-guild invites without relationship lookup", async (t) => {
        const harness = setupInviteFriendMembersMocks(t, {
            invite: { guild_id: null },
        });

        assert.deepEqual(await buildInviteFriendMembersResponse("requester", "friend-code"), { friend_member_ids: [] });
        assert.equal(harness.inviteFindOptions.length, 1);
        assert.equal(harness.relationshipFindOptions.length, 0);
        assert.equal(harness.memberFindOptions.length, 0);
    });

    test("returns only current-user friends who are locally known members of the target guild", async (t) => {
        const harness = setupInviteFriendMembersMocks(t, {
            invite: { guild_id: "guild-1" },
            relationships: [{ to_id: "friend-b" }, { to_id: "friend-a" }, { to_id: "not-a-member" }],
            members: [{ id: "friend-b" }, { id: "friend-a" }],
        });

        assert.deepEqual(await buildInviteFriendMembersResponse("requester", "guild-code"), {
            friend_member_ids: ["friend-a", "friend-b"],
        });

        assert.deepEqual(harness.inviteFindOptions[0], {
            where: { code: "guild-code" },
            select: {
                code: true,
                guild_id: true,
            },
        });
        assert.deepEqual(harness.relationshipFindOptions[0], {
            where: {
                from_id: "requester",
                type: RelationshipType.friends,
            },
            select: {
                to_id: true,
            },
            order: {
                to_id: "ASC",
            },
        });
        assert.equal((harness.memberFindOptions[0] as { where: { guild_id: string } }).where.guild_id, "guild-1");
        assert.equal(harness.memberFindOptions.length, 1);
    });

    test("returns JSON from the mounted route", async (t) => {
        setupInviteFriendMembersMocks(t, {
            invite: { guild_id: "guild-1" },
            relationships: [{ to_id: "friend-1" }],
            members: [{ id: "friend-1" }],
        });

        const app = appWithInvitesRouter("requester");
        const response = await requestJson(app, "/invites/guild-code/friend-members");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { friend_member_ids: ["friend-1"] });
    });

    test("uses existing invite lookup 404 behavior for unknown invite codes", async (t) => {
        setupInviteFriendMembersMocks(t, {
            inviteError: entityNotFoundError(),
        });

        const app = appWithInvitesRouter("requester");
        const response = await requestJson(app, "/invites/missing-code/friend-members");

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
            catalog.find((route) => route.method === "GET" && route.route === "/invites/{invite_code}/friend-members"),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "InviteFriendMembersResponse"],
                route: "/invites/{invite_code}/friend-members",
                route_name: "GET_INVITES_INVITE_CODE_FRIEND_MEMBERS",
                source: "src/api/routes/invites/index.ts",
            },
        );

        const manifestEntry = manifest.entries.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "InviteFriendMembersResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 401, 404]);
    });

    test("documents bearer security and schemas in OpenAPI", () => {
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

        const operation = openApi.paths["/invites/{invite_code}/friend-members"]?.get;

        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/InviteFriendMembersResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
    });
});

function setupInviteFriendMembersMocks(
    t: TestContext,
    options: {
        invite?: { guild_id: string | null };
        inviteError?: Error;
        members?: Array<{ id: string }>;
        relationships?: Array<{ to_id: string }>;
    },
) {
    const inviteFindOptions: unknown[] = [];
    const relationshipFindOptions: unknown[] = [];
    const memberFindOptions: unknown[] = [];

    t.mock.method(Invite, "findOneOrFail", async (findOptions: unknown) => {
        inviteFindOptions.push(findOptions);
        if (options.inviteError) throw options.inviteError;
        return options.invite ?? { guild_id: null };
    });
    t.mock.method(Relationship, "find", async (findOptions: unknown) => {
        relationshipFindOptions.push(findOptions);
        return options.relationships ?? [];
    });
    t.mock.method(Member, "find", async (findOptions: unknown) => {
        memberFindOptions.push(findOptions);
        return options.members ?? [];
    });

    return {
        inviteFindOptions,
        relationshipFindOptions,
        memberFindOptions,
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
