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
import { join } from "node:path";
import { describe, test, type TestContext } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import type { Message } from "@spacebar/util";
import express from "express";
import { createPreloadMessagesRouter, parsePreloadMessageChannelIdsQuery, type PreloadMessagesRouteDependencies } from "../../src/api/routes/channels/preload-messages";

const assignedPath = "/channels/preload-messages";
const sourceFile = "src/api/routes/channels/preload-messages.ts";
const deleteManifestId = "api:http:DELETE:/channels/preload-messages/";
const getManifestId = "api:http:GET:/channels/preload-messages/";
const postManifestId = "api:http:POST:/channels/preload-messages/";
const putManifestId = "api:http:PUT:/channels/preload-messages/";

describe("/channels/preload-messages", () => {
    test("documents route identity and keeps the route behind bearer authentication", async (t) => {
        const dependencies = createDependencies(t, {
            getAuthorizedChannelIds: t.mock.fn(async () => {
                throw new Error("authorization lookup should not run without a bearer token");
            }),
            findLatestMessage: t.mock.fn(async () => {
                throw new Error("message lookup should not run without a bearer token");
            }),
        });

        const app = createAuthenticatedApp(dependencies);

        assert.equal(isNoAuthorizationRoute("DELETE", "/api/v9/channels/preload-messages"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/channels/preload-messages"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/channels/preload-messages"), false);
        assert.equal(isNoAuthorizationRoute("PUT", "/api/v9/channels/preload-messages"), false);
        assert.deepEqual(parsePreloadMessageChannelIdsQuery({ channels: "local-post-alias", channel_ids: "documented-query" }), ["documented-query"]);

        const response = await requestJson(app, "/channels/preload-messages?channel_ids=visible");
        const deleteResponse = await requestJson(app, "/channels/preload-messages", { method: "DELETE" });
        const putResponse = await requestJson(app, "/channels/preload-messages", { method: "PUT" });

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(deleteResponse.status, 401);
        assert.match((deleteResponse.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(putResponse.status, 401);
        assert.match((putResponse.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(mockOf(dependencies.getAuthorizedChannelIds).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findLatestMessage).mock.callCount(), 0);
    });

    test("preloads latest authorized channel messages from source-backed channel_ids query values", async (t) => {
        const dependencies = createDependencies(t, {
            authorizedChannelIds: ["visible", "empty"],
            latestMessages: {
                visible: fakeMessage("latest-visible", "visible"),
            },
        });

        const response = await requestJson(createApp(dependencies), "/channels/preload-messages?channel_ids=visible,private&channel_ids[]=empty");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [
            {
                id: "latest-visible",
                channel_id: "visible",
            },
        ]);
        assert.equal("reactions" in ((response.body as Record<string, unknown>[])[0] ?? {}), false);
        assert.deepEqual(mockOf(dependencies.getAuthorizedChannelIds).mock.calls[0].arguments, ["viewer", ["visible", "private", "empty"]]);
        assert.deepEqual(
            mockOf(dependencies.findLatestMessage).mock.calls.map((call) => call.arguments[0]),
            ["visible", "empty"],
        );
    });

    test("rejects GET requests that exceed the preload channel limit before authorization or message lookup", async (t) => {
        const dependencies = createDependencies(t, {
            maxPreloadCount: 2,
        });

        const response = await requestJson(createApp(dependencies), "/channels/preload-messages?channel_ids=one,two,three");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: 400,
            message: "Cannot preload more than 2 channels at once.",
        });
        assert.equal(mockOf(dependencies.getAuthorizedChannelIds).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findLatestMessage).mock.callCount(), 0);
    });

    test("preserves POST preload-messages body behavior while sharing authorization and serialization", async (t) => {
        const dependencies = createDependencies(t, {
            authorizedChannelIds: ["visible"],
            latestMessages: {
                visible: fakeMessage("latest-visible", "visible"),
            },
        });

        const response = await requestJson(createApp(dependencies), "/channels/preload-messages", {
            method: "POST",
            body: {
                channel_ids: ["visible"],
            },
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [
            {
                id: "latest-visible",
                channel_id: "visible",
            },
        ]);
        assert.deepEqual(mockOf(dependencies.getAuthorizedChannelIds).mock.calls[0].arguments, ["viewer", ["visible"]]);
    });

    test("preloads PUT message previews with the same local body contract as POST", async (t) => {
        const dependencies = createDependencies(t, {
            authorizedChannelIds: ["visible"],
            latestMessages: {
                visible: fakeMessage("latest-visible", "visible"),
            },
        });

        const response = await requestJson(createApp(dependencies), "/channels/preload-messages", {
            method: "PUT",
            body: {
                channels: ["visible", "private"],
            },
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [
            {
                id: "latest-visible",
                channel_id: "visible",
            },
        ]);
        assert.deepEqual(mockOf(dependencies.getAuthorizedChannelIds).mock.calls[0].arguments, ["viewer", ["visible", "private"]]);
    });

    test("acknowledges DELETE preload-messages cache invalidation without touching message storage", async (t) => {
        const dependencies = createDependencies(t, {
            getAuthorizedChannelIds: t.mock.fn(async () => {
                throw new Error("delete does not need channel authorization without local preview cache rows");
            }),
            findLatestMessage: t.mock.fn(async () => {
                throw new Error("delete must not load message previews");
            }),
        });

        const response = await requestJson(createApp(dependencies), "/channels/preload-messages", {
            method: "DELETE",
            body: {
                channel_ids: ["visible"],
            },
        });

        assert.deepEqual(response, { status: 204, body: undefined });
        assert.equal(mockOf(dependencies.getAuthorizedChannelIds).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findLatestMessage).mock.callCount(), 0);
    });

    test("declares source-backed generated artifacts and leaves adjacent MESSAGE_PREVIEWS methods missing", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "channels", "preload-messages.ts"), "utf8");
        const openapi = readJson<OpenApiDocument>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<SourceCatalogEntry[]>(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const xhyromCatalog = readJson<RouteCatalogEntry[]>(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.xhyrom.catalog.json"));
        const userdoccersCatalog = readJson<RouteCatalogEntry[]>(
            join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.userdoccers.catalog.json"),
        );
        const manifest = readJson<TestingManifest>(join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<HttpContracts>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<SuiteCoverage>(join(process.cwd(), "test", "generated", "suite-coverage.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.match(routeSource, /router\.get\(\s*"\//);
        assert.match(routeSource, /router\.post\(\s*"\//);
        assert.match(routeSource, /router\.put\(\s*"\//);
        assert.match(routeSource, /router\.delete\(\s*"\//);
        assert.match(routeSource, /channel_ids:\s*\{\s*type:\s*"array"/s);
        assert.match(routeSource, /204:\s*\{\s*\}/s);
        assert.doesNotMatch(routeSource, /router\.patch\(/);
        assert.doesNotMatch(routeSource, /messages\/search|\/pins|\/threads|\/ack|\/typing|bulk-delete/);

        const openApiRoute = openapi.paths["/channels/preload-messages/"];
        assert.equal(openApiRoute?.delete?.summary, "Delete Preloaded Message Previews");
        assert.equal(openApiRoute?.delete?.requestBody, undefined);
        assert.equal(openApiRoute?.delete?.responses?.["204"]?.content, undefined);
        assert.equal(openApiRoute?.delete?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openApiRoute?.get?.summary, "Preload Messages");
        assert.equal(
            openApiRoute?.get?.parameters?.some((parameter) => parameter.in === "query" && parameter.name === "channel_ids" && parameter.schema?.type === "array"),
            true,
        );
        assert.equal(openApiRoute?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PreloadMessagesResponse");
        assert.equal(openApiRoute?.get?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openApiRoute?.get?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openApiRoute?.post?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PreloadMessagesRequestSchema");
        assert.equal(openApiRoute?.post?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PreloadMessagesResponse");
        assert.equal(openApiRoute?.put?.summary, "Preload Messages");
        assert.equal(openApiRoute?.put?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PreloadMessagesRequestSchema");
        assert.equal(openApiRoute?.put?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PreloadMessagesResponse");
        assert.equal(openApiRoute?.put?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openApiRoute?.put?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openApiRoute?.patch, undefined);

        const sourceEntries = sourceCatalog.filter((entry) => entry.route === assignedPath);
        assert.deepEqual(sourceEntries.map((entry) => entry.method).sort(), ["DELETE", "GET", "POST", "PUT"]);
        assert.deepEqual(
            sourceEntries.find((entry) => entry.method === "DELETE"),
            {
                method: "DELETE",
                response_schema_refs: ["APIErrorResponse"],
                route: assignedPath,
                route_name: "DELETE_CHANNELS_PRELOAD_MESSAGES",
                source: sourceFile,
            },
        );
        assert.deepEqual(
            sourceEntries.find((entry) => entry.method === "GET"),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "PreloadMessagesResponse"],
                route: assignedPath,
                route_name: "GET_CHANNELS_PRELOAD_MESSAGES",
                source: sourceFile,
            },
        );
        assert.equal(sourceEntries.find((entry) => entry.method === "POST")?.request_schema_ref, "PreloadMessagesRequestSchema");
        assert.deepEqual(
            sourceEntries.find((entry) => entry.method === "PUT"),
            {
                method: "PUT",
                request_schema_ref: "PreloadMessagesRequestSchema",
                response_schema_refs: ["APIErrorResponse", "PreloadMessagesResponse"],
                route: assignedPath,
                route_name: "PUT_CHANNELS_PRELOAD_MESSAGES",
                source: sourceFile,
            },
        );

        assert.deepEqual(
            xhyromCatalog
                .filter((entry) => entry.route === assignedPath && entry.route_name === "MESSAGE_PREVIEWS")
                .map((entry) => entry.method)
                .sort(),
            ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
        );
        assert.deepEqual(
            userdoccersCatalog.filter((entry) => entry.route === assignedPath).map((entry) => `${entry.method} ${entry.route_name}`),
            ["POST POST_CHANNELS_PRELOAD_MESSAGES"],
        );

        const deleteManifestEntry = manifest.entries?.find((entry) => entry.id === deleteManifestId);
        assert.equal(deleteManifestEntry?.authMode, "bearer");
        assert.equal(deleteManifestEntry?.path, "/channels/preload-messages/");
        assert.equal(deleteManifestEntry?.sourceFile, sourceFile);
        assert.equal(deleteManifestEntry?.routeMetadata?.hasQuery, false);
        assert.equal(deleteManifestEntry?.routeMetadata?.requestBody, undefined);
        assert.deepEqual(deleteManifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(
            deleteManifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [204, 401],
        );

        const getManifestEntry = manifest.entries?.find((entry) => entry.id === getManifestId);
        assert.equal(getManifestEntry?.authMode, "bearer");
        assert.equal(getManifestEntry?.path, "/channels/preload-messages/");
        assert.equal(getManifestEntry?.sourceFile, sourceFile);
        assert.equal(getManifestEntry?.routeMetadata?.hasQuery, true);
        assert.deepEqual(getManifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "PreloadMessagesResponse"]);
        assert.deepEqual(
            getManifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401],
        );

        const postManifestEntry = manifest.entries?.find((entry) => entry.id === postManifestId);
        assert.equal(postManifestEntry?.routeMetadata?.requestBody, "PreloadMessagesRequestSchema");
        assert.equal(postManifestEntry?.routeMetadata?.hasQuery, false);

        const putManifestEntry = manifest.entries?.find((entry) => entry.id === putManifestId);
        assert.equal(putManifestEntry?.authMode, "bearer");
        assert.equal(putManifestEntry?.path, "/channels/preload-messages/");
        assert.equal(putManifestEntry?.sourceFile, sourceFile);
        assert.equal(putManifestEntry?.routeMetadata?.requestBody, "PreloadMessagesRequestSchema");
        assert.equal(putManifestEntry?.routeMetadata?.hasQuery, false);
        assert.deepEqual(putManifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "PreloadMessagesResponse"]);
        assert.deepEqual(
            putManifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401],
        );

        const deleteContract = contracts.contracts?.find((entry) => entry.manifestId === deleteManifestId);
        assert.equal(deleteContract?.authMode, "bearer");
        assert.equal(deleteContract?.sourceFile, sourceFile);
        assert.deepEqual(deleteContract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(
            deleteContract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [204, 401],
        );

        const getContract = contracts.contracts?.find((entry) => entry.manifestId === getManifestId);
        assert.equal(getContract?.authMode, "bearer");
        assert.equal(getContract?.sourceFile, sourceFile);
        assert.deepEqual(getContract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "PreloadMessagesResponse"]);

        const putContract = contracts.contracts?.find((entry) => entry.manifestId === putManifestId);
        assert.equal(putContract?.authMode, "bearer");
        assert.equal(putContract?.sourceFile, sourceFile);
        assert.deepEqual(putContract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "PreloadMessagesResponse"]);
        assert.deepEqual(
            putContract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401],
        );

        const coveredManifestIds = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).flatMap((suite) => suite.manifestIds ?? []) ?? [];
        assert.equal(coveredManifestIds.includes(deleteManifestId), true);
        assert.equal(coveredManifestIds.includes(getManifestId), true);
        assert.equal(coveredManifestIds.includes(postManifestId), true);
        assert.equal(coveredManifestIds.includes(putManifestId), true);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "DELETE" && entry.route === assignedPath),
            false,
        );
        assert.deepEqual(
            missingRoutes.missing_entries
                .filter((entry) => entry.route === assignedPath)
                .map((entry) => entry.method)
                .sort(),
            ["PATCH"],
        );
    });
});

type RouteCatalogEntry = {
    method?: string;
    route?: string;
    route_name?: string;
    source?: string;
    summary?: string;
};

type SourceCatalogEntry = RouteCatalogEntry & {
    request_schema_ref?: string;
    response_schema_refs?: string[];
};

type OpenApiDocument = {
    paths: Record<
        string,
        {
            get?: OpenApiOperation;
            post?: OpenApiOperation;
            delete?: OpenApiOperation;
            patch?: OpenApiOperation;
            put?: OpenApiOperation;
        }
    >;
};

type OpenApiOperation = {
    summary?: string;
    parameters?: { in?: string; name?: string; schema?: { type?: string } }[];
    requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
    responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
};

type TestingManifest = {
    entries?: {
        authMode?: string;
        id?: string;
        path?: string;
        routeMetadata?: {
            hasQuery?: boolean;
            requestBody?: string;
            responseBodies?: string[];
            responseStatuses?: number[];
        };
        sourceFile?: string;
    }[];
};

type HttpContracts = {
    contracts?: {
        authMode?: string;
        manifestId?: string;
        routeMetadata?: {
            responses?: string[];
            responseStatuses?: number[];
        };
        sourceFile?: string;
    }[];
};

type SuiteCoverage = {
    groups?: { suites?: { manifestIds?: string[] }[] }[];
};

type MissingRoutesReport = {
    missing_entries: { method?: string; route?: string; route_name?: string }[];
};

type RequestOptions = {
    method?: string;
    body?: unknown;
};

type TestDependenciesOptions = {
    authorizedChannelIds?: string[];
    findLatestMessage?: PreloadMessagesRouteDependencies["findLatestMessage"];
    getAuthorizedChannelIds?: PreloadMessagesRouteDependencies["getAuthorizedChannelIds"];
    latestMessages?: Record<string, Message>;
    maxPreloadCount?: number;
};

function createApp(dependencies: PreloadMessagesRouteDependencies) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/channels/preload-messages", createPreloadMessagesRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createAuthenticatedApp(dependencies: PreloadMessagesRouteDependencies) {
    const app = express();
    app.use(Authentication);
    app.use("/channels/preload-messages", createPreloadMessagesRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createDependencies(t: TestContext, options: TestDependenciesOptions = {}): Required<PreloadMessagesRouteDependencies> {
    const authorizedChannelIds = new Set(options.authorizedChannelIds ?? []);
    const latestMessages = options.latestMessages ?? {};

    return {
        getAuthorizedChannelIds: options.getAuthorizedChannelIds ?? t.mock.fn(async (_userId: string | undefined, _channelIds: string[]) => authorizedChannelIds),
        findLatestMessage: options.findLatestMessage ?? t.mock.fn(async (channelId: string) => latestMessages[channelId] ?? null),
        getMaxPreloadCount: t.mock.fn(() => options.maxPreloadCount ?? 100),
        serializeMessage: t.mock.fn((message: Message) => {
            const { reactions, ...preloadMessage } = message.toJSON() as unknown as Record<string, unknown>;
            void reactions;
            return preloadMessage as never;
        }),
    };
}

function fakeMessage(id: string, channelId: string): Message {
    return {
        toJSON() {
            return {
                id,
                channel_id: channelId,
                reactions: ["hidden"],
            };
        },
    } as unknown as Message;
}

function mockOf<TArgs extends unknown[], TReturn>(fn: (...args: TArgs) => TReturn) {
    return fn as ((...args: TArgs) => TReturn) & {
        mock: {
            callCount(): number;
            calls: Array<{ arguments: TArgs }>;
        };
    };
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

function requestJson(app: express.Express, path: string, options: RequestOptions = {}) {
    return new Promise<{ body: unknown; status: number }>((resolve, reject) => {
        const server = app.listen(0, "127.0.0.1", async () => {
            const address = server.address() as AddressInfo;
            try {
                const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
                    method: options.method ?? "GET",
                    headers: {
                        "content-type": "application/json",
                    },
                    body: options.body === undefined ? undefined : JSON.stringify(options.body),
                });
                const text = await response.text();
                resolve({
                    body: text ? JSON.parse(text) : undefined,
                    status: response.status,
                });
            } catch (error) {
                reject(error);
            } finally {
                server.close();
            }
        });
    });
}
