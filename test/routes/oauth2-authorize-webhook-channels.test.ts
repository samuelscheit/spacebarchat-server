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
import http from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { describe, test } from "node:test";
import { isNoAuthorizationRoute } from "@spacebar/api";
import { ChannelPermissionOverwriteType, ChannelType } from "@spacebar/schemas";
import { DiscordApiErrors, Permissions } from "@spacebar/util";
import express from "express";
import {
    canInstallOAuthWebhookInChannel,
    createOAuthAuthorizeWebhookChannelsRouter,
    getOAuthAuthorizeWebhookChannels,
    isOAuthAuthorizeWebhookChannelType,
    type OAuthAuthorizeWebhookChannelsDependencies,
    type OAuthAuthorizeWebhookChannelSource,
    type OAuthAuthorizeWebhookGuildSource,
    type OAuthAuthorizeWebhookMemberSource,
} from "../../src/api/routes/oauth2/authorize/webhook-channels";

const coveredManifestId = "api:http:GET:/oauth2/authorize/webhook-channels/";
const assignedPath = "/oauth2/authorize/webhook-channels";
const routeSourceFile = "src/api/routes/oauth2/authorize/webhook-channels.ts";

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string;
};

const guild = {
    id: "100000000000000001",
    owner_id: "owner",
    channel_ordering: ["hidden-channel", "allowed-news", "allowed-text", "unordered-text"],
} satisfies OAuthAuthorizeWebhookGuildSource;

const member = {
    id: "member",
    communication_disabled_until: null,
    user: { flags: 0 },
    roles: [
        {
            id: "role",
            permissions: (Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.MANAGE_WEBHOOKS).toString(),
        },
    ],
} satisfies OAuthAuthorizeWebhookMemberSource;

function channel(overrides: Partial<OAuthAuthorizeWebhookChannelSource> = {}): OAuthAuthorizeWebhookChannelSource {
    return {
        id: "allowed-text",
        name: "general",
        type: ChannelType.GUILD_TEXT,
        guild_id: guild.id,
        permission_overwrites: [],
        ...overrides,
    };
}

function dependencies(overrides: Partial<OAuthAuthorizeWebhookChannelsDependencies> = {}): Required<OAuthAuthorizeWebhookChannelsDependencies> {
    return {
        findGuild: async () => guild,
        findMember: async () => member,
        findChannels: async () => [],
        ...overrides,
    };
}

function createApp(userId: string, deps: OAuthAuthorizeWebhookChannelsDependencies) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = userId;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/oauth2/authorize/webhook-channels", createOAuthAuthorizeWebhookChannelsRouter(deps));
    app.use(
        (error: { code?: number | string; httpStatus?: number; status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            res.status(error.httpStatus ?? error.status ?? 400).json({ code: error.code, message: error.message });
        },
    );

    return app;
}

async function requestJson(app: express.Express, requestPath: string) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${requestPath}`);
        const text = await response.text();
        return {
            status: response.status,
            body: text ? (JSON.parse(text) as unknown) : undefined,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("GET /oauth2/authorize/webhook-channels", () => {
    test("declares the webhook-channel picker as authenticated and leaves adjacent OAuth routes unchanged", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/oauth2/authorize/webhook-channels"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/oauth2/authorize/webhook-channels/?guild_id=100000000000000001"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/oauth2/authorize"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/oauth2/authorize"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/oauth2/samsung/authorize"), false);
    });

    test("recognizes only guild text and announcement channels as webhook-installable", () => {
        assert.equal(isOAuthAuthorizeWebhookChannelType(ChannelType.GUILD_TEXT), true);
        assert.equal(isOAuthAuthorizeWebhookChannelType(ChannelType.GUILD_NEWS), true);
        assert.equal(isOAuthAuthorizeWebhookChannelType(ChannelType.GUILD_VOICE), false);
        assert.equal(isOAuthAuthorizeWebhookChannelType(ChannelType.GUILD_FORUM), false);
        assert.equal(isOAuthAuthorizeWebhookChannelType(ChannelType.DM), false);
    });

    test("filters channels by guild, type, name, view access, and manage-webhooks permission", async () => {
        const hiddenChannel = channel({
            id: "hidden-channel",
            name: "hidden",
            permission_overwrites: [
                {
                    id: "role",
                    type: ChannelPermissionOverwriteType.role,
                    allow: "0",
                    deny: Permissions.FLAGS.VIEW_CHANNEL.toString(),
                },
            ],
        });
        const blockedWebhookChannel = channel({
            id: "blocked-webhooks",
            name: "blocked",
            permission_overwrites: [
                {
                    id: "role",
                    type: ChannelPermissionOverwriteType.role,
                    allow: "0",
                    deny: Permissions.FLAGS.MANAGE_WEBHOOKS.toString(),
                },
            ],
        });
        const allowedNews = channel({ id: "allowed-news", name: "announcements", type: ChannelType.GUILD_NEWS });
        const allowedText = channel({ id: "allowed-text", name: "general" });
        const unorderedText = channel({ id: "unordered-text", name: "aaa" });
        const voiceChannel = channel({ id: "voice", name: "voice", type: ChannelType.GUILD_VOICE });
        const namelessChannel = channel({ id: "nameless", name: undefined });
        const otherGuildChannel = channel({ id: "other-guild", guild_id: "200000000000000002" });

        assert.equal(canInstallOAuthWebhookInChannel("member", guild, member, allowedText), true);
        assert.equal(canInstallOAuthWebhookInChannel("member", guild, member, hiddenChannel), false);
        assert.equal(canInstallOAuthWebhookInChannel("member", guild, member, blockedWebhookChannel), false);

        const result = await getOAuthAuthorizeWebhookChannels(
            "member",
            guild.id,
            dependencies({
                findChannels: async () => [hiddenChannel, blockedWebhookChannel, allowedText, voiceChannel, allowedNews, namelessChannel, otherGuildChannel, unorderedText],
            }),
        );

        assert.deepEqual(result, [
            {
                id: "allowed-news",
                name: "announcements",
                type: ChannelType.GUILD_NEWS,
                guild_id: guild.id,
            },
            {
                id: "allowed-text",
                name: "general",
                type: ChannelType.GUILD_TEXT,
                guild_id: guild.id,
            },
            {
                id: "unordered-text",
                name: "aaa",
                type: ChannelType.GUILD_TEXT,
                guild_id: guild.id,
            },
        ]);
    });

    test("returns 403 when the current user is not a member of the selected guild", async () => {
        await assert.rejects(
            () =>
                getOAuthAuthorizeWebhookChannels(
                    "stranger",
                    guild.id,
                    dependencies({
                        findMember: async () => null,
                    }),
                ),
            (error) => (error as { code?: number; httpStatus?: number }).code === DiscordApiErrors.MISSING_ACCESS.code && (error as { httpStatus?: number }).httpStatus === 403,
        );
    });

    test("serves the channel picker response and requires guild_id", async () => {
        const app = createApp(
            "member",
            dependencies({
                findChannels: async () => [channel()],
            }),
        );

        const success = await requestJson(app, `/oauth2/authorize/webhook-channels?guild_id=${guild.id}`);
        const missingGuild = await requestJson(app, "/oauth2/authorize/webhook-channels");

        assert.equal(success.status, 200);
        assert.deepEqual(success.body, [
            {
                id: "allowed-text",
                name: "general",
                type: ChannelType.GUILD_TEXT,
                guild_id: guild.id,
            },
        ]);
        assert.equal(missingGuild.status, 400);
    });

    test("documents route metadata for the generated source catalog", () => {
        const routeSource = readFileSync(join(process.cwd(), routeSourceFile), "utf8");

        assert.match(routeSource, /summary:\s*"Get OAuth2 Authorize Webhook Channels"/);
        assert.match(routeSource, /guild_id:\s*\{\s*type:\s*"string",\s*required:\s*true/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"OAuthAuthorizeWebhookChannelsResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("generates source catalog, missing-route, OpenAPI, manifest, and contract metadata", () => {
        const sourceCatalog = readJson<
            {
                method?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(
            join(process.cwd(), "packages", "missing-routes", "missing.json"),
        );
        const openapi = readJson<{
            components?: { schemas?: Record<string, JsonSchema> };
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: {
                            description?: string;
                            in?: string;
                            name?: string;
                            required?: boolean;
                            schema?: { type?: string };
                        }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                id?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedPath);
        assert.equal(sourceEntry?.route_name, "GET_OAUTH2_AUTHORIZE_WEBHOOK_CHANNELS");
        assert.equal(sourceEntry?.source, routeSourceFile);
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "OAuthAuthorizeWebhookChannelsResponse"]);
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/oauth2/authorize/webhook-channels"),
            false,
        );

        const route = openapi.paths?.["/oauth2/authorize/webhook-channels/"]?.get;
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.deepEqual(route?.parameters, [
            {
                name: "guild_id",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                },
                description: "Guild to inspect for webhook-installable channels.",
            },
        ]);
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/OAuthAuthorizeWebhookChannelsResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapi.components?.schemas?.OAuthAuthorizeWebhookChannelsResponse?.type, "array");
        assert.equal(openapi.components?.schemas?.OAuthAuthorizeWebhookChannelsResponse?.items?.$ref, "#/components/schemas/OAuthAuthorizeWebhookChannel");
        assert.deepEqual(openapi.components?.schemas?.OAuthAuthorizeWebhookChannel?.required, ["guild_id", "id", "name", "type"]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "OAuthAuthorizeWebhookChannelsResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 400, 401, 403, 404]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "OAuthAuthorizeWebhookChannelsResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401, 403, 404]);
    });
});
