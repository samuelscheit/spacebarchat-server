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
import { join } from "node:path";
import { describe, test, type TestContext } from "node:test";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import { createStreamPreviewRouter, parseStreamKey, UNKNOWN_STREAM, type StreamPreviewDependencies } from "../../src/api/routes/streams/#stream_key/preview";
import { ChannelType } from "../../src/schemas";
import { DiscordApiErrors } from "@spacebar/util";

const guildId = "200000000000000002";
const channelId = "300000000000000003";
const ownerId = "400000000000000004";
const viewerId = "100000000000000001";
const streamId = "500000000000000005";
const guildStreamKey = `guild:${guildId}:${channelId}:${ownerId}`;
const callStreamKey = `call:${channelId}:${ownerId}`;
const validThumbnail = "data:image/png;base64,iVBORw0KGgo=";
const coveredGetManifestId = "api:http:GET:/streams/:stream_key/preview/";
const coveredPostManifestId = "api:http:POST:/streams/:stream_key/preview/";

describe("GET /streams/:stream_key/preview", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredGetManifestId, "api:http:GET:/streams/:stream_key/preview/");
    });

    test("parses documented guild and call stream keys", () => {
        assert.deepEqual(parseStreamKey(guildStreamKey), {
            type: "guild",
            guildId,
            channelId,
            userId: ownerId,
        });
        assert.deepEqual(parseStreamKey(callStreamKey), {
            type: "call",
            channelId,
            guildId: undefined,
            userId: ownerId,
        });
    });

    test("maps malformed stream keys to the Discord unknown stream error", () => {
        assert.throws(
            () => parseStreamKey("guild:missing-parts"),
            (error) => error === UNKNOWN_STREAM,
        );
        assert.throws(
            () => parseStreamKey(`guild:${guildId}:${channelId}:${ownerId}:extra`),
            (error) => error === UNKNOWN_STREAM,
        );
        assert.throws(
            () => parseStreamKey("invalid:stream:key"),
            (error) => error === UNKNOWN_STREAM,
        );
    });

    test("stays behind bearer authentication", async (t) => {
        const dependencies = createThrowingDependencies(t);

        assert.equal(isNoAuthorizationRoute("GET", `/streams/${guildStreamKey}/preview`), false);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/streams/${guildStreamKey}/preview`), false);

        const response = await request(createAuthenticatedApp(dependencies), `/streams/${guildStreamKey}/preview`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(mockOf(dependencies.findChannel).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.getPermission).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findStream).mock.callCount(), 0);
    });

    test("returns no content for an accessible active stream when no local preview source exists", async (t) => {
        const dependencies = createDependencies(t);

        const response = await request(createApp(dependencies), `/streams/${guildStreamKey}/preview`);

        assert.equal(response.status, 204);
        assert.equal(response.body, undefined);
        assert.deepEqual(mockOf(dependencies.findChannel).mock.calls[0].arguments[0], {
            where: { id: channelId },
            select: { id: true, guild_id: true, type: true },
        });
        assert.deepEqual(mockOf(dependencies.getPermission).mock.calls[0].arguments, [viewerId, guildId, channelId]);
        assert.deepEqual(dependencies.permissionChecks, ["CONNECT"]);
        assert.deepEqual(mockOf(dependencies.findStream).mock.calls[0].arguments, [channelId, ownerId]);
    });

    test("allows call stream previews only for non-guild voice-capable channels", async (t) => {
        const dependencies = createDependencies(t, {
            findChannel: t.mock.fn(async () => ({ id: channelId, guild_id: undefined, type: ChannelType.DM })),
        });

        const response = await request(createApp(dependencies), `/streams/${callStreamKey}/preview`);

        assert.equal(response.status, 204);
        assert.deepEqual(mockOf(dependencies.getPermission).mock.calls[0].arguments, [viewerId, undefined, channelId]);
        assert.deepEqual(mockOf(dependencies.findStream).mock.calls[0].arguments, [channelId, ownerId]);
    });

    test("rejects malformed stream keys before channel, permission, or stream lookups", async (t) => {
        const dependencies = createDependencies(t);

        const response = await request(createApp(dependencies), "/streams/not-a-stream-key/preview");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: UNKNOWN_STREAM.code,
            message: UNKNOWN_STREAM.message,
        });
        assert.equal(mockOf(dependencies.findChannel).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.getPermission).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findStream).mock.callCount(), 0);
    });

    test("rejects stream keys that do not match the resolved channel", async (t) => {
        const dependencies = createDependencies(t, {
            findChannel: t.mock.fn(async () => ({ id: channelId, guild_id: "other-guild", type: ChannelType.GUILD_VOICE })),
        });

        const response = await request(createApp(dependencies), `/streams/${guildStreamKey}/preview`);

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: UNKNOWN_STREAM.code,
            message: UNKNOWN_STREAM.message,
        });
        assert.equal(mockOf(dependencies.getPermission).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findStream).mock.callCount(), 0);
    });

    test("requires CONNECT access before exposing stream existence", async (t) => {
        const dependencies = createDependencies(t, { permissionDenied: true });

        const response = await request(createApp(dependencies), `/streams/${guildStreamKey}/preview`);

        assert.equal(response.status, 403);
        assert.equal((response.body as { code?: unknown }).code, DiscordApiErrors.MISSING_PERMISSIONS.code);
        assert.deepEqual(dependencies.permissionChecks, ["CONNECT"]);
        assert.equal(mockOf(dependencies.findStream).mock.callCount(), 0);
    });

    test("returns unknown stream when the active stream record is absent", async (t) => {
        const dependencies = createDependencies(t, {
            findStream: t.mock.fn(async () => null),
        });

        const response = await request(createApp(dependencies), `/streams/${guildStreamKey}/preview`);

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: UNKNOWN_STREAM.code,
            message: UNKNOWN_STREAM.message,
        });
    });

    test("declares source-backed route metadata and leaves adjacent stream routes untouched", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "streams", "#stream_key", "preview.ts"), "utf8");
        const openapi = readJson<OpenApiDocument>(join("assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join("assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const userdoccersCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.userdoccers.catalog.json"));
        const xhyromCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.xhyrom.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join("packages", "missing-routes", "missing.json"));
        const contracts = readJson<HttpContractCatalog>(join("test", "generated", "http-contracts.json"));

        assert.match(routeSource, /summary:\s*"Get Stream Preview"/);
        assert.match(routeSource, /does not currently persist uploaded stream preview images/);
        assert.match(routeSource, /204:\s*\{\}/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        const operation = openapi.paths?.["/streams/{stream_key}/preview/"]?.get ?? openapi.paths?.["/streams/{stream_key}/preview"]?.get;
        assert.equal(operation?.summary, "Get Stream Preview");
        assert.equal(operation?.responses?.["204"]?.description, "No description available");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(operation?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredGetManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/streams/#stream_key/preview.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [204, 401, 403, 404]);

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/streams/{stream_key}/preview");
        assert.equal(sourceEntry?.route_name, "GET_STREAMS_STREAM_KEY_PREVIEW");
        assert.equal(sourceEntry?.source, "src/api/routes/streams/#stream_key/preview.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs, ["APIErrorResponse"]);

        const userdoccersEntry = userdoccersCatalog.find((entry) => entry.method === "GET" && entry.route === "/streams/{stream_key}/preview");
        assert.equal(userdoccersEntry?.route_name, "GET_STREAMS_STREAM_KEY_PREVIEW");
        assert.equal(userdoccersEntry?.summary, "Get Stream Preview");
        assert.equal(userdoccersEntry?.source, "userdoccers:resources/voice.mdx");

        const xhyromEntry = xhyromCatalog.find((entry) => entry.method === "GET" && entry.route === "/streams/{param}/preview");
        assert.equal(xhyromEntry?.route_name, "STREAM_PREVIEW");
        assert.equal(xhyromEntry?.source, "xhyrom:data/client/routes.json");

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredGetManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [204, 401, 403, 404]);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/streams/{param}/preview"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "POST" && entry.route === "/streams/{param}/preview"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "POST" && entry.route === "/streams/{param}/preview/video"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "POST" && entry.route === "/streams/{param}/notify"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "PATCH" && entry.route === "/streams/{param}/stream"),
            true,
        );
        assert.deepEqual(
            sourceCatalog
                .filter((entry) => entry.route === "/streams/{stream_key}/preview")
                .map((entry) => entry.method)
                .sort(),
            ["GET", "POST"],
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.route === "/streams/{stream_key}/notify"),
            false,
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.route === "/streams/{stream_key}/preview/video"),
            false,
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.route === "/streams/{stream_key}/stream"),
            false,
        );
    });
});

describe("POST /streams/:stream_key/preview", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredPostManifestId, "api:http:POST:/streams/:stream_key/preview/");
    });

    test("stays behind bearer authentication", async (t) => {
        const dependencies = createThrowingDependencies(t);

        assert.equal(isNoAuthorizationRoute("POST", `/streams/${guildStreamKey}/preview`), false);
        assert.equal(isNoAuthorizationRoute("POST", `/api/v9/streams/${guildStreamKey}/preview`), false);

        const response = await request(createAuthenticatedApp(dependencies), `/streams/${guildStreamKey}/preview`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ thumbnail: validThumbnail }),
        });

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(mockOf(dependencies.findChannel).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.getPermission).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findStream).mock.callCount(), 0);
    });

    test("validates the documented thumbnail image data body before stream lookups", async (t) => {
        const dependencies = createThrowingDependencies(t);

        const response = await request(createApp(dependencies, ownerId), `/streams/${guildStreamKey}/preview`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ thumbnail: "not-image-data" }),
        });

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, 50035);
        assert.match((response.body as { message?: string }).message ?? "", /Invalid Form Body/);
        assert.equal(mockOf(dependencies.findChannel).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.getPermission).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findStream).mock.callCount(), 0);
    });

    test("uploads through the configured preview persistence dependency for an owned active stream", async (t) => {
        const dependencies = createDependencies(t, {
            uploadPreview: t.mock.fn(async () => undefined),
        });

        const response = await request(createApp(dependencies, ownerId), `/streams/${guildStreamKey}/preview`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ thumbnail: validThumbnail }),
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, undefined);
        assert.deepEqual(mockOf(dependencies.findChannel).mock.calls[0].arguments[0], {
            where: { id: channelId },
            select: { id: true, guild_id: true, type: true },
        });
        assert.equal(mockOf(dependencies.getPermission).mock.callCount(), 0);
        assert.deepEqual(mockOf(dependencies.findStream).mock.calls[0].arguments, [channelId, ownerId]);
        assert.deepEqual(mockOf(dependencies.uploadPreview!).mock.calls[0].arguments[0], {
            streamKey: {
                type: "guild",
                guildId,
                channelId,
                userId: ownerId,
            },
            channel: {
                id: channelId,
                guild_id: guildId,
                type: ChannelType.GUILD_VOICE,
            },
            stream: {
                id: streamId,
                channel_id: channelId,
                owner_id: ownerId,
            },
            userId: ownerId,
            thumbnail: validThumbnail,
        });
    });

    test("rejects non-owner stream keys before channel or stream lookups", async (t) => {
        const dependencies = createDependencies(t);

        const response = await request(createApp(dependencies), `/streams/${guildStreamKey}/preview`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ thumbnail: validThumbnail }),
        });

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: UNKNOWN_STREAM.code,
            message: UNKNOWN_STREAM.message,
        });
        assert.equal(mockOf(dependencies.findChannel).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.getPermission).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findStream).mock.callCount(), 0);
    });

    test("fails closed when no durable local stream preview storage provider is configured", async (t) => {
        const dependencies = createDependencies(t);

        const response = await request(createApp(dependencies, ownerId), `/streams/${guildStreamKey}/preview`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ thumbnail: validThumbnail }),
        });

        assert.equal(response.status, 501);
        assert.equal((response.body as { code?: unknown }).code, 501);
        assert.match((response.body as { message?: string }).message ?? "", /Stream preview image uploads are not supported/);
        assert.equal(mockOf(dependencies.findChannel).mock.callCount(), 1);
        assert.equal(mockOf(dependencies.findStream).mock.callCount(), 1);
    });

    test("declares source-backed route metadata and leaves sibling stream routes untouched", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "streams", "#stream_key", "preview.ts"), "utf8");
        const openapi = readJson<OpenApiDocument>(join("assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join("assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const userdoccersCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.userdoccers.catalog.json"));
        const xhyromCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.xhyrom.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join("packages", "missing-routes", "missing.json"));
        const contracts = readJson<HttpContractCatalog>(join("test", "generated", "http-contracts.json"));

        assert.match(routeSource, /summary:\s*"Upload Stream Preview"/);
        assert.match(routeSource, /requestBody:\s*"StreamPreviewUploadSchema"/);
        assert.match(routeSource, /default server fails closed with 501/);

        const operation = openapi.paths?.["/streams/{stream_key}/preview/"]?.post ?? openapi.paths?.["/streams/{stream_key}/preview"]?.post;
        assert.equal(operation?.summary, "Upload Stream Preview");
        assert.equal(operation?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StreamPreviewUploadSchema");
        assert.equal(operation?.responses?.["204"]?.description, "No description available");
        assert.equal(operation?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(operation?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredPostManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/streams/#stream_key/preview.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "StreamPreviewUploadSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [204, 400, 401, 404, 501]);

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/streams/{stream_key}/preview");
        assert.equal(sourceEntry?.route_name, "POST_STREAMS_STREAM_KEY_PREVIEW");
        assert.equal(sourceEntry?.source, "src/api/routes/streams/#stream_key/preview.ts");
        assert.equal(sourceEntry?.request_schema_ref, "StreamPreviewUploadSchema");
        assert.deepEqual(sourceEntry?.response_schema_refs, ["APIErrorResponse"]);

        const userdoccersEntry = userdoccersCatalog.find((entry) => entry.method === "POST" && entry.route === "/streams/{stream_key}/preview");
        assert.equal(userdoccersEntry?.route_name, "POST_STREAMS_STREAM_KEY_PREVIEW");
        assert.equal(userdoccersEntry?.summary, "Upload Stream Preview");
        assert.equal(userdoccersEntry?.source, "userdoccers:resources/voice.mdx");

        const xhyromEntry = xhyromCatalog.find((entry) => entry.method === "POST" && entry.route === "/streams/{param}/preview");
        assert.equal(xhyromEntry?.route_name, "STREAM_PREVIEW");
        assert.equal(xhyromEntry?.source, "xhyrom:data/client/routes.json");

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredPostManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.requestBody, "StreamPreviewUploadSchema");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [204, 400, 401, 404, 501]);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "POST" && entry.route === "/streams/{param}/preview"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "POST" && entry.route === "/streams/{param}/preview/video"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "POST" && entry.route === "/streams/{param}/notify"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "PATCH" && entry.route === "/streams/{param}/stream"),
            true,
        );
    });
});

function createApp(dependencies: StreamPreviewDependencies, userId = viewerId) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/streams/:stream_key/preview", createStreamPreviewRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createAuthenticatedApp(dependencies: StreamPreviewDependencies) {
    const app = express();
    app.use(express.json());
    app.use(Authentication);
    app.use("/streams/:stream_key/preview", createStreamPreviewRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createThrowingDependencies(t: TestContext) {
    return createDependencies(t, {
        findChannel: t.mock.fn(async () => {
            throw new Error("channel lookup should not run");
        }),
        getPermission: t.mock.fn(async () => {
            throw new Error("permission lookup should not run");
        }),
        findStream: t.mock.fn(async () => {
            throw new Error("stream lookup should not run");
        }),
    });
}

function createDependencies(
    t: TestContext,
    overrides: Partial<StreamPreviewDependencies> & { permissionDenied?: boolean } = {},
): StreamPreviewDependencies & { permissionChecks: string[] } {
    const permissionChecks: string[] = [];

    return {
        permissionChecks,
        findChannel: t.mock.fn(async () => ({ id: channelId, guild_id: guildId, type: ChannelType.GUILD_VOICE })),
        getPermission: t.mock.fn(async () => ({
            hasThrow(permission: unknown) {
                permissionChecks.push(String(permission));
                if (overrides.permissionDenied) throw DiscordApiErrors.MISSING_PERMISSIONS.withParams(String(permission));
                return true;
            },
        })),
        findStream: t.mock.fn(async () => ({ id: streamId, channel_id: channelId, owner_id: ownerId })),
        ...overrides,
    };
}

async function request(app: express.Express, requestPath: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown> | undefined }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, init);
        const text = await response.text();

        return {
            status: response.status,
            body: text ? (JSON.parse(text) as Record<string, unknown>) : undefined,
        };
    } finally {
        server.close();
    }
}

function mockOf<T extends (...args: never[]) => unknown>(fn: T) {
    return fn as T & {
        mock: {
            callCount(): number;
            calls: Array<{ arguments: Parameters<T> }>;
        };
    };
}

function readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf8")) as T;
}

type OpenApiDocument = {
    paths?: Record<
        string,
        {
            get?: OpenApiOperation;
            post?: OpenApiOperation;
        }
    >;
};

type OpenApiOperation = {
    summary?: string;
    requestBody?: {
        content?: Record<string, { schema?: { $ref?: string } }>;
    };
    responses?: Record<string, { description?: string; content?: Record<string, { schema?: { $ref?: string } }> }>;
    security?: unknown;
};

type TestingManifest = {
    entries?: {
        id?: string;
        authMode?: string;
        sourceFile?: string;
        routeMetadata?: {
            requestBody?: string;
            responseBodies?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type SourceRouteCatalogEntry = {
    method?: string;
    request_schema_ref?: string;
    response_schema_refs?: string[];
    route?: string;
    route_name?: string;
    source?: string;
    summary?: string;
};

type MissingRoutesReport = {
    missing_entries: {
        method?: string;
        route?: string;
    }[];
};

type HttpContractCatalog = {
    contracts?: {
        manifestId?: string;
        authMode?: string;
        routeMetadata?: {
            requestBody?: string;
            responses?: string[];
            responseStatuses?: number[];
        };
    }[];
};
