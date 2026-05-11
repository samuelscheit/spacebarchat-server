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
import { ChannelType } from "@spacebar/schemas";
import { Channel, DiscordApiErrors, DmChannelDTO, Recipient, User } from "@spacebar/util";
import express from "express";
import { ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import dmChannelRouter, {
    UNKNOWN_DM_CHANNEL,
    UNKNOWN_DM_USER,
    assertDmChannelsReadScopeForOAuthToken,
    getExistingCurrentUserDmChannel,
    hasOAuthScope,
    selectExistingCurrentUserDmChannel,
} from "../../src/api/routes/users/@me/dms/#user_id";

const manifestId = "api:http:GET:/users/@me/dms/:user_id/";
const routePath = "/users/@me/dms/:user_id/";

type JsonResponse = {
    status: number;
    body: Record<string, unknown>;
};

describe("GET /users/@me/dms/:user_id", () => {
    test("requires dm_channels.read only for OAuth-style scoped tokens", () => {
        assert.doesNotThrow(() => assertDmChannelsReadScopeForOAuthToken({ id: "viewer", iat: 1 }));
        assert.equal(hasOAuthScope({ scope: "identify dm_channels.read" }), true);
        assert.equal(hasOAuthScope({ scopes: ["identify", "dm_channels.read"] }), true);
        assert.equal(hasOAuthScope({ scp: "identify,dm_channels.read" }), true);
        assert.equal(hasOAuthScope({ scope: "identify" }), false);
        assert.throws(() => assertDmChannelsReadScopeForOAuthToken({ scope: "identify" }), {
            code: DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE.code,
        });
    });

    test("selects the newest active locally backed one-to-one DM and ignores group DMs", () => {
        const older = createChannel("older-dm", ChannelType.DM, ["viewer", "target"], new Date("2026-01-01T00:00:00.000Z"));
        const newer = createChannel("newer-dm", ChannelType.DM, ["viewer", "target"], new Date("2026-02-01T00:00:00.000Z"));
        const group = createChannel("group-dm", ChannelType.GROUP_DM, ["viewer", "target"], new Date("2026-03-01T00:00:00.000Z"));

        assert.equal(selectExistingCurrentUserDmChannel([{ channel: older }, { channel: group }, { channel: newer }], "viewer", "target")?.id, "newer-dm");
        assert.equal(selectExistingCurrentUserDmChannel([{ channel: createChannel("extra-dm", ChannelType.DM, ["viewer", "target", "third"]) }], "viewer", "target"), undefined);
    });

    test("loads an existing current-user DM without creating or reopening one", async (t) => {
        const harness = setupDmChannelMocks(t, {
            targetUser: { id: "target" },
            recipients: [
                { channel: createChannel("older-dm", ChannelType.DM, ["viewer", "target"], new Date("2026-01-01T00:00:00.000Z")) },
                { channel: createChannel("newer-dm", ChannelType.DM, ["viewer", "target"], new Date("2026-02-01T00:00:00.000Z")) },
            ],
        });

        const dto = await getExistingCurrentUserDmChannel("viewer", "target");

        assert.deepEqual(dto, {
            id: "newer-dm",
            excludedRecipients: ["viewer"],
            type: ChannelType.DM,
        });
        assert.deepEqual(harness.userFindOptions, [
            {
                where: { id: "target" },
                select: { id: true },
            },
        ]);
        assert.deepEqual(harness.recipientFindOptions, [
            {
                where: { user_id: "viewer", closed: false },
                relations: { channel: { recipients: true } },
            },
        ]);
        assert.deepEqual(harness.dtoFromCalls, [{ channelId: "newer-dm", excludedRecipients: ["viewer"] }]);
        assert.equal(harness.createdDmChannels.length, 0);
    });

    test("returns the current-user relative DM channel from the mounted route", async (t) => {
        setupDmChannelMocks(t, {
            targetUser: { id: "target" },
            recipients: [{ channel: createChannel("dm-id", ChannelType.DM, ["viewer", "target"]) }],
        });
        const app = createRouteApp({ token: { id: "viewer", iat: 1 } });

        const response = await requestJson(app, "/users/@me/dms/target");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            id: "dm-id",
            excludedRecipients: ["viewer"],
            type: ChannelType.DM,
        });
    });

    test("fails closed for unknown users before recipient lookup", async (t) => {
        const harness = setupDmChannelMocks(t, {
            targetUser: null,
            recipients: [{ channel: createChannel("dm-id", ChannelType.DM, ["viewer", "target"]) }],
        });
        const app = createRouteApp();

        const response = await requestJson(app, "/users/@me/dms/target");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: UNKNOWN_DM_USER.code,
            message: UNKNOWN_DM_USER.message,
        });
        assert.equal(harness.recipientFindOptions.length, 0);
        assert.equal(harness.dtoFromCalls.length, 0);
        assert.equal(harness.createdDmChannels.length, 0);
    });

    test("fails closed when no active local one-to-one DM exists", async (t) => {
        const harness = setupDmChannelMocks(t, {
            targetUser: { id: "target" },
            recipients: [
                { channel: createChannel("group-dm", ChannelType.GROUP_DM, ["viewer", "target"]) },
                { channel: createChannel("other-dm", ChannelType.DM, ["viewer", "other"]) },
            ],
        });
        const app = createRouteApp();

        const response = await requestJson(app, "/users/@me/dms/target");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: UNKNOWN_DM_CHANNEL.code,
            message: UNKNOWN_DM_CHANNEL.message,
        });
        assert.equal(harness.dtoFromCalls.length, 0);
        assert.equal(harness.createdDmChannels.length, 0);
    });

    test("rejects missing OAuth scope before user and DM lookups", async (t) => {
        const harness = setupDmChannelMocks(t, {
            targetUser: { id: "target" },
            recipients: [{ channel: createChannel("dm-id", ChannelType.DM, ["viewer", "target"]) }],
        });
        const app = createRouteApp({ token: { scope: "identify" } });

        const response = await requestJson(app, "/users/@me/dms/target");

        assert.equal(response.status, 400);
        assert.equal(response.body.code, DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE.code);
        assert.equal(harness.userFindOptions.length, 0);
        assert.equal(harness.recipientFindOptions.length, 0);
    });

    test("stays behind bearer authentication and does not use DM creation helpers", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/dms/100000000000000001"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/users/@me/dms/100000000000000001"), false);

        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "dms", "#user_id.ts"), "utf-8");
        assert.match(routeSource, /summary:\s*"Get DM Channel"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"DmChannelDTO"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /createDMChannel\(/);
        assert.match(routeSource, /Recipient\.find\(\{[\s\S]*where:\s*\{\s*user_id:\s*currentUserId,\s*closed:\s*false\s*\}/);
    });

    test("is present in regenerated source catalog, manifest, contracts, and OpenAPI", () => {
        const sourceCatalog = JSON.parse(
            readFileSync(path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf-8"),
        ) as Array<{
            method: string;
            response_schema_refs?: string[];
            route: string;
            route_name: string;
            source: string;
        }>;
        const missingRoutes = JSON.parse(readFileSync(path.join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf-8")) as {
            missing_entries: Array<{ method: string; route: string; route_name: string }>;
        };
        const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "testing-manifest.json"), "utf-8")) as {
            entries?: Array<{
                id?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }>;
        };
        const contracts = JSON.parse(readFileSync(path.join(process.cwd(), "test", "generated", "http-contracts.json"), "utf-8")) as {
            contracts?: Array<{
                manifestId: string;
                authMode: string;
                path: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }>;
        };
        const openApi = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf-8")) as {
            paths: Record<
                string,
                {
                    get?: {
                        security?: Array<Record<string, unknown[]>>;
                        responses?: Record<string, { content?: { "application/json"?: { schema?: { $ref?: string } } } }>;
                    };
                }
            >;
        };

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/dms/{user_id}"),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "DmChannelDTO"],
                route: "/users/@me/dms/{user_id}",
                route_name: "GET_USERS__ME_DMS_USER_ID",
                source: "src/api/routes/users/@me/dms/#user_id.ts",
            },
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route_name === "GET_USERS__ME_DMS_USER_ID"),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "DmChannelDTO"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 404],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === manifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, routePath);
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "DmChannelDTO"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 404],
        );

        const operation = openApi.paths["/users/@me/dms/{user_id}/"]?.get;
        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/DmChannelDTO");
        assert.equal(operation?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
    });
});

function createChannel(id: string, type: ChannelType, userIds: string[], created_at: Date = new Date("2026-01-01T00:00:00.000Z")) {
    return {
        id,
        type,
        created_at,
        recipients: userIds.map((user_id) => ({ user_id, closed: user_id === "viewer" ? false : true })),
    };
}

function setupDmChannelMocks(
    t: TestContext,
    options: {
        targetUser: { id: string } | null;
        recipients: Array<{ channel: ReturnType<typeof createChannel> }>;
    },
) {
    const originalUserFindOne = User.findOne;
    const originalRecipientFind = Recipient.find;
    const originalDtoFrom = DmChannelDTO.from;
    const originalCreateDMChannel = Channel.createDMChannel;
    const userFindOptions: unknown[] = [];
    const recipientFindOptions: unknown[] = [];
    const dtoFromCalls: Array<{ channelId: string; excludedRecipients: string[] }> = [];
    const createdDmChannels: unknown[] = [];

    t.after(() => {
        User.findOne = originalUserFindOne;
        Recipient.find = originalRecipientFind;
        DmChannelDTO.from = originalDtoFrom;
        Channel.createDMChannel = originalCreateDMChannel;
    });

    User.findOne = (async (findOptions: unknown) => {
        userFindOptions.push(findOptions);
        return options.targetUser;
    }) as typeof User.findOne;
    Recipient.find = (async (findOptions: unknown) => {
        recipientFindOptions.push(findOptions);
        return options.recipients;
    }) as typeof Recipient.find;
    DmChannelDTO.from = (async (channel: ReturnType<typeof createChannel>, excludedRecipients: string[] = []) => {
        dtoFromCalls.push({ channelId: channel.id, excludedRecipients });
        return {
            id: channel.id,
            excludedRecipients,
            type: channel.type,
        } as unknown as DmChannelDTO;
    }) as typeof DmChannelDTO.from;
    Channel.createDMChannel = (async (...args: unknown[]) => {
        createdDmChannels.push(args);
        throw new Error("GET /users/@me/dms/:user_id must not create or reopen DMs");
    }) as typeof Channel.createDMChannel;

    return {
        createdDmChannels,
        dtoFromCalls,
        recipientFindOptions,
        userFindOptions,
    };
}

function createRouteApp(options: { token?: unknown } = {}) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        req.token = (options.token ?? { id: "viewer", iat: 1 }) as never;
        next();
    });
    app.use("/users/@me/dms/:user_id", dmChannelRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string): Promise<JsonResponse> {
    const { server, baseUrl } = await listen(app);
    try {
        const response = await fetch(`${baseUrl}${requestPath}`);
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
