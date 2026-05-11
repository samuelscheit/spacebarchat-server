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
import { join } from "node:path";
import { describe, test, type TestContext } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import { ChannelType } from "@spacebar/schemas";
import { DiscordApiErrors, Recipient } from "@spacebar/util";
import express from "express";
import partnerSdkUserMessageSummariesRouter, {
    assertDmChannelsReadScopeForOAuthToken,
    getPartnerSdkUserMessageSummaries,
    hasOAuthScope,
    serializePartnerSdkUserMessageSummaries,
    type PartnerSdkCurrentUserMessageSummaryRecipient,
    type PartnerSdkUserMessageSummaryChannel,
} from "../../src/api/routes/partner-sdk/users/@me/channels";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const manifestId = "api:http:GET:/partner-sdk/users/@me/channels/";
const routePath = "/partner-sdk/users/@me/channels/";

type JsonResponse = {
    status: number;
    body: Record<string, unknown> | unknown[];
};

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /partner-sdk/users/@me/channels", () => {
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

    test("serializes only locally backed one-to-one DM message summaries", () => {
        const summaries = serializePartnerSdkUserMessageSummaries(
            [
                currentUserRecipient(createChannel(ChannelType.DM, "200000000000000000", ["viewer", "target"], ["target"])),
                currentUserRecipient(createChannel(ChannelType.EPHEMERAL_DM, "300000000000000000", ["viewer", "partner-user"])),
                currentUserRecipient(createChannel(ChannelType.GROUP_DM, "400000000000000000", ["viewer", "target", "third"])),
                currentUserRecipient(createChannel(ChannelType.DM, null, ["viewer", "empty-dm"])),
                currentUserRecipient(createChannel(ChannelType.DM, "500000000000000000", ["viewer", "target", "third"])),
            ],
            "viewer",
        );

        assert.deepEqual(summaries, [
            {
                user_id: "partner-user",
                last_message_id: "300000000000000000",
            },
            {
                user_id: "target",
                last_message_id: "200000000000000000",
            },
        ]);
    });

    test("loads current-user DM channels without creating or fabricating message summaries", async (t) => {
        const harness = setupRecipientFind(t, [
            currentUserRecipient(createChannel(ChannelType.DM, "100000000000000001", ["viewer", "target"])),
            currentUserRecipient(createChannel(ChannelType.DM, null, ["viewer", "empty-dm"])),
        ]);

        const response = await getPartnerSdkUserMessageSummaries("viewer");

        assert.deepEqual(response, [
            {
                user_id: "target",
                last_message_id: "100000000000000001",
            },
        ]);
        assert.deepEqual(harness.findOptions, [
            {
                where: { user_id: "viewer", closed: false },
                relations: { channel: { recipients: true } },
            },
        ]);
    });

    test("returns summaries from the mounted route", async (t) => {
        setupRecipientFind(t, [currentUserRecipient(createChannel(ChannelType.DM, "100000000000000001", ["viewer", "target"]))]);
        const app = createRouteApp({ token: { id: "viewer", iat: 1 } });

        const response = await requestJson(app, "/partner-sdk/users/@me/channels");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [
            {
                user_id: "target",
                last_message_id: "100000000000000001",
            },
        ]);
    });

    test("rejects missing OAuth scope before local DM lookup", async (t) => {
        const harness = setupRecipientFind(t, [currentUserRecipient(createChannel(ChannelType.DM, "100000000000000001", ["viewer", "target"]))]);
        const app = createRouteApp({ token: { scope: "identify" } });

        const response = await requestJson(app, "/partner-sdk/users/@me/channels");

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: number }).code, DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE.code);
        assert.deepEqual(harness.findOptions, []);
    });

    test("stays behind bearer authentication and declares route metadata", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/partner-sdk/users/@me/channels"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/partner-sdk/users/@me/channels/"), false);

        const authResponse = await requestJson(createAuthenticatedApp(), "/partner-sdk/users/@me/channels");
        assert.equal(authResponse.status, 401);
        assert.match((authResponse.body as { message?: string }).message ?? "", /Missing Authorization Header/);

        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "partner-sdk", "users", "@me", "channels.ts"), "utf8");
        assert.match(routeSource, /summary:\s*"Get User Message Summaries"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"PartnerSdkUserMessageSummariesResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /Recipient\.find\(\{[\s\S]*where:\s*\{\s*user_id:\s*currentUserId,\s*closed:\s*false\s*\}/);
    });

    test("is present in regenerated schemas, catalogs, manifest, contracts, and OpenAPI", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openApi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            route?: string;
            route_name?: string;
            source?: string;
            response_schema_refs?: string[];
        }[];
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        };
        const contractTests = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                manifestId?: string;
                authMode?: string;
                path?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };

        assert.equal(schemas.PartnerSdkUserMessageSummariesResponse.type, "array");
        assert.equal(schemas.PartnerSdkUserMessageSummariesResponse.items?.$ref, "#/definitions/PartnerSdkUserMessageSummaryResponse");
        assert.deepEqual(schemas.PartnerSdkUserMessageSummaryResponse.required?.sort(), ["last_message_id", "user_id"]);
        assert.equal(schemas.PartnerSdkUserMessageSummaryResponse.properties?.user_id?.type, "string");
        assert.equal(schemas.PartnerSdkUserMessageSummaryResponse.properties?.last_message_id?.type, "string");

        const operation = openApi.paths?.["/partner-sdk/users/@me/channels/"]?.get;
        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PartnerSdkUserMessageSummariesResponse");
        assert.equal(operation?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "PartnerSdkUserMessageSummariesResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401],
        );

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/partner-sdk/users/@me/channels"),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "PartnerSdkUserMessageSummariesResponse"],
                route: "/partner-sdk/users/@me/channels",
                route_name: "GET_PARTNER_SDK_USERS__ME_CHANNELS",
                source: "src/api/routes/partner-sdk/users/@me/channels.ts",
            },
        );
        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "GET" && entry.route === "/partner-sdk/users/@me/channels" && entry.route_name === "GET_PARTNER_SDK_USERS__ME_CHANNELS",
            ),
            false,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === manifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, routePath);
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "PartnerSdkUserMessageSummariesResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401],
        );
    });
});

function createChannel(type: ChannelType, last_message_id: string | null, userIds: string[], closedUserIds: string[] = []): PartnerSdkUserMessageSummaryChannel {
    return {
        type,
        last_message_id: last_message_id ?? undefined,
        recipients: userIds.map((user_id) => ({
            user_id,
            closed: closedUserIds.includes(user_id),
        })),
    };
}

function currentUserRecipient(channel: PartnerSdkUserMessageSummaryChannel): PartnerSdkCurrentUserMessageSummaryRecipient {
    return { channel };
}

function setupRecipientFind(t: TestContext, recipients: PartnerSdkCurrentUserMessageSummaryRecipient[]) {
    const originalRecipientFind = Recipient.find;
    const findOptions: unknown[] = [];

    t.after(() => {
        Recipient.find = originalRecipientFind;
    });

    Recipient.find = (async (options: unknown) => {
        findOptions.push(options);
        return recipients as Recipient[];
    }) as typeof Recipient.find;

    return {
        findOptions,
    };
}

function createRouteApp(options: { token?: unknown } = {}) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        req.token = (options.token ?? { id: "viewer", iat: 1 }) as never;
        next();
    });
    app.use("/partner-sdk/users/@me/channels", partnerSdkUserMessageSummariesRouter);
    app.use(ErrorHandler);
    return app;
}

function createAuthenticatedApp() {
    const app = express();
    app.use(Authentication);
    app.use("/partner-sdk/users/@me/channels", partnerSdkUserMessageSummariesRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string): Promise<JsonResponse> {
    const { server, baseUrl } = await listen(app);
    try {
        const response = await fetch(`${baseUrl}${requestPath}`);
        return {
            status: response.status,
            body: (await response.json()) as JsonResponse["body"],
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
