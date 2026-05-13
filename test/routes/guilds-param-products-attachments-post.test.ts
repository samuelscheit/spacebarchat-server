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
import express from "express";
import { EntityNotFoundError } from "typeorm";
import productAttachmentsRouter, { sanitizeGuildProductAttachmentFilename } from "../../src/api/routes/guilds/#guild_id/products/attachments";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const requireModule = require;
const coveredManifestId = "api:http:POST:/guilds/:guild_id/products/attachments/";
const guildId = "200000000000000002";
const viewerId = "100000000000000001";

describe("POST /guilds/:guild_id/products/attachments", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredManifestId, "api:http:POST:/guilds/:guild_id/products/attachments/");
    });

    test("uses the shared Discord upload-reservation filename sanitization", () => {
        assert.equal(sanitizeGuildProductAttachmentFilename("Product Icon!.png"), "Product_Icon.png");
        assert.equal(sanitizeGuildProductAttachmentFilename("clip 01.mov"), "clip_01.mov");
    });

    test("stays behind bearer authentication", async () => {
        assert.equal(isNoAuthorizationRoute("POST", `/guilds/${guildId}/products/attachments`), false);
        assert.equal(isNoAuthorizationRoute("POST", `/api/v9/guilds/${guildId}/products/attachments`), false);

        const app = express();
        app.use(express.json());
        app.use(Authentication);
        app.use("/guilds/:guild_id/products/attachments", productAttachmentsRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, `/guilds/${guildId}/products/attachments`, {
            method: "POST",
            body: validUploadBody(),
        });

        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
    });

    test("reserves guild product attachment uploads for guild managers", async (t) => {
        const permissionLookups: unknown[][] = [];
        const guildLookups: unknown[] = [];
        const createCalls: CloudAttachmentCreateCall[] = [];
        const saveCalls: CloudAttachmentCreateCall[] = [];

        mockPermissions(t, true, permissionLookups);
        mockGuildLookup(t, guildLookups);
        mockConfigEndpoint(t, "https://cdn.example");
        mockCloudAttachmentCreate(t, createCalls, saveCalls);

        const response = await requestJson(createAuthenticatedRouteApp(), `/guilds/${guildId}/products/attachments`, {
            method: "POST",
            body: validUploadBody(),
        });

        assert.equal(response.status, 200);
        const body = response.body as { attachments?: { id?: string; upload_filename?: string; upload_url?: string; original_content_type?: string }[] };
        assert.equal(body.attachments?.length, 1);
        assert.equal(body.attachments?.[0]?.id, "0");
        assert.equal(body.attachments?.[0]?.original_content_type, "image/png");
        assert.match(body.attachments?.[0]?.upload_filename ?? "", /^200000000000000002\/products\/CLOUD_100000000000000001_[A-Za-z0-9]+\/0\/Product_Icon\.png$/);
        assert.equal(body.attachments?.[0]?.upload_url, `https://cdn.example/_spacebar/cdn/attachments/${body.attachments?.[0]?.upload_filename}`);
        assert.deepEqual(permissionLookups, [[viewerId, guildId, undefined]]);
        assert.deepEqual(guildLookups, [
            {
                where: { id: guildId },
                select: { id: true },
            },
        ]);
        assert.equal(createCalls.length, 1);
        assert.equal(createCalls[0].user?.id, viewerId);
        assert.equal(createCalls[0].channel, undefined);
        assert.equal(createCalls[0].userAttachmentId, "0");
        assert.equal(createCalls[0].userFilename, "Product_Icon.png");
        assert.equal(createCalls[0].userFileSize, 42);
        assert.equal(createCalls[0].userIsClip, false);
        assert.equal(createCalls[0].userOriginalContentType, "image/png");
        assert.deepEqual(saveCalls, createCalls);
    });

    test("returns 403 before reading guild or attachment state when the user lacks MANAGE_GUILD", async (t) => {
        const permissionLookups: unknown[][] = [];
        const guildLookups: unknown[] = [];
        const createCalls: CloudAttachmentCreateCall[] = [];
        const saveCalls: CloudAttachmentCreateCall[] = [];

        mockPermissions(t, false, permissionLookups);
        mockGuildLookup(t, guildLookups);
        mockCloudAttachmentCreate(t, createCalls, saveCalls);

        const response = await requestJson(createAuthenticatedRouteApp(), `/guilds/${guildId}/products/attachments`, {
            method: "POST",
            body: validUploadBody(),
        });

        assert.equal(response.status, 403);
        assert.equal((response.body as { code?: unknown }).code, 50013);
        assert.deepEqual(permissionLookups, [[viewerId, guildId, undefined]]);
        assert.deepEqual(guildLookups, []);
        assert.deepEqual(createCalls, []);
        assert.deepEqual(saveCalls, []);
    });

    test("returns the existing API 404 when the guild does not exist", async (t) => {
        const createCalls: CloudAttachmentCreateCall[] = [];
        const saveCalls: CloudAttachmentCreateCall[] = [];

        mockPermissions(t, true);
        mockMissingGuildLookup(t);
        mockCloudAttachmentCreate(t, createCalls, saveCalls);

        const response = await requestJson(createAuthenticatedRouteApp(), `/guilds/${guildId}/products/attachments`, {
            method: "POST",
            body: validUploadBody(),
        });

        assert.equal(response.status, 404);
        assert.equal((response.body as { code?: unknown }).code, 404);
        assert.equal((response.body as { message?: unknown }).message, "Guild could not be found");
        assert.deepEqual(createCalls, []);
        assert.deepEqual(saveCalls, []);
    });

    test("rejects duplicate upload attachment IDs before reserving files", async (t) => {
        const createCalls: CloudAttachmentCreateCall[] = [];
        const saveCalls: CloudAttachmentCreateCall[] = [];

        mockPermissions(t, true);
        mockGuildLookup(t, []);
        mockCloudAttachmentCreate(t, createCalls, saveCalls);

        const response = await requestJson(createAuthenticatedRouteApp(), `/guilds/${guildId}/products/attachments`, {
            method: "POST",
            body: {
                files: [
                    { id: "0", filename: "first.png", file_size: 1 },
                    { id: "0", filename: "second.png", file_size: 1 },
                ],
            },
        });

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: 400,
            message: "Duplicate attachment ID: 0",
        });
        assert.deepEqual(createCalls, []);
        assert.deepEqual(saveCalls, []);
    });

    test("declares schema, route catalog, manifest, contract, suite, and missing-route movement for only the assigned POST route", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "products", "attachments.ts"), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(join("assets", "schemas.json"));
        const openapi = readJson<OpenApiDocument>(join("assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join("assets", "testing-manifest.json"));
        const contracts = readJson<HttpContractCatalog>(join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<SuiteCoverage>(join("test", "generated", "suite-coverage.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join("packages", "missing-routes", "missing.json"));

        assert.match(routeSource, /router\.post\(\s*["']\/["']/);
        assert.doesNotMatch(routeSource, /router\.(?:get|put|patch|delete)\(/);
        assert.match(routeSource, /summary:\s*"Create Guild Product Attachment Upload"/);
        assert.match(routeSource, /requestBody:\s*"UploadAttachmentRequestSchema"/);
        assert.match(routeSource, /permission:\s*"MANAGE_GUILD"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"UploadAttachmentResponseSchema"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.UploadAttachmentRequestSchema?.properties?.files?.items?.$ref, "#/definitions/UploadAttachmentRequest");
        assert.equal(schemas.UploadAttachmentResponseSchema?.properties?.attachments?.items?.$ref, "#/definitions/UploadAttachmentResponse");

        const route = openapi.paths?.["/guilds/{guild_id}/products/attachments/"]?.post;
        assert.equal(route?.summary, "Create Guild Product Attachment Upload");
        assert.equal(route?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UploadAttachmentRequestSchema");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UploadAttachmentResponseSchema");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.["x-permission-required"], "MANAGE_GUILD");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/guilds/{guild_id}/products/attachments/"]?.get, undefined);
        assert.equal(openapi.paths?.["/guilds/{guild_id}/products/attachments/"]?.put, undefined);
        assert.equal(openapi.paths?.["/guilds/{guild_id}/products/attachments/"]?.patch, undefined);
        assert.equal(openapi.paths?.["/guilds/{guild_id}/products/attachments/"]?.delete, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/products/attachments.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "UploadAttachmentRequestSchema");
        assert.equal(manifestEntry?.routeMetadata?.permission, "MANAGE_GUILD");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("UploadAttachmentResponseSchema"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 400, 401, 403, 404],
        );

        const contractEntry = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contractEntry?.sourceFile, "src/api/routes/guilds/#guild_id/products/attachments.ts");
        assert.equal(contractEntry?.routeMetadata?.requestBody, "UploadAttachmentRequestSchema");
        assert.equal(contractEntry?.routeMetadata?.permission, "MANAGE_GUILD");
        assert.equal(contractEntry?.routeMetadata?.responses?.includes("UploadAttachmentResponseSchema"), true);
        assert.equal(contractEntry?.routeMetadata?.responses?.includes("APIErrorResponse"), true);
        assert.equal(
            contractEntry?.cases?.some((entry) => entry.id === "invalid-request-body"),
            true,
        );
        assert.equal(
            contractEntry?.cases?.some((entry) => entry.id === "authorization-denied"),
            true,
        );

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/guilds/{guild_id}/products/attachments");
        assert.equal(sourceRoute?.route_name, "POST_GUILDS_GUILD_ID_PRODUCTS_ATTACHMENTS");
        assert.equal(sourceRoute?.source, "src/api/routes/guilds/#guild_id/products/attachments.ts");
        assert.equal(sourceRoute?.request_schema_ref, "UploadAttachmentRequestSchema");
        assert.deepEqual(sourceRoute?.response_schema_refs?.sort(), ["APIErrorResponse", "UploadAttachmentResponseSchema"]);

        const guildsSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "guilds");
        assert.equal(guildsSuite?.manifestIds?.includes(coveredManifestId), true);

        assert.equal(
            missingRoutes.missing_entries.some(
                (entry) => entry.method === "POST" && entry.route === "/guilds/{param}/products/attachments" && entry.route_name === "GUILD_PRODUCT_CREATE_ATTACHMENT_UPLOAD",
            ),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "POST" && entry.route === "/guilds/{param}/products"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "POST" && entry.route === "/guilds/{param}/products/listings/{param}/attachments/{param}/download"),
            true,
        );
    });
});

function validUploadBody() {
    return {
        files: [
            {
                id: "0",
                filename: "Product Icon!.png",
                file_size: 42,
                is_clip: false,
                original_content_type: "image/png",
            },
        ],
    };
}

function createAuthenticatedRouteApp() {
    const app = express();

    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = viewerId;
        req.user = { id: viewerId } as never;
        next();
    });
    app.use("/guilds/:guild_id/products/attachments", productAttachmentsRouter);
    app.use(ErrorHandler);

    return app;
}

function mockPermissions(t: TestContext, hasManageGuild: boolean, permissionLookups: unknown[][] = []) {
    const permissionsModule = requireModule(join(process.cwd(), "dist", "util", "util", "Permissions.js")) as {
        getPermission: (...args: unknown[]) => Promise<unknown>;
    };

    t.mock.method(permissionsModule, "getPermission", async (...args: unknown[]) => {
        permissionLookups.push(args);

        return {
            has: () => hasManageGuild,
        };
    });
}

function mockGuildLookup(t: TestContext, guildLookups: unknown[]) {
    const util = requireModule("@spacebar/util") as typeof import("../../src/util");

    t.mock.method(util.Guild, "findOneOrFail", async (findOptions: unknown) => {
        guildLookups.push(findOptions);
        return { id: guildId };
    });
}

function mockMissingGuildLookup(t: TestContext) {
    const util = requireModule("@spacebar/util") as typeof import("../../src/util");

    t.mock.method(util.Guild, "findOneOrFail", async (findOptions: { where?: unknown }) => {
        throw new EntityNotFoundError(util.Guild, findOptions.where);
    });
}

function mockConfigEndpoint(t: TestContext, endpointPublic: string) {
    const util = requireModule("@spacebar/util") as typeof import("../../src/util");

    t.mock.method(util.Config, "get", () => ({
        cdn: {
            endpointPublic,
        },
    }));
}

function mockCloudAttachmentCreate(t: TestContext, createCalls: CloudAttachmentCreateCall[], saveCalls: CloudAttachmentCreateCall[]) {
    const util = requireModule("@spacebar/util") as typeof import("../../src/util");

    t.mock.method(util.CloudAttachment, "create", (fields: CloudAttachmentCreateCall) => {
        createCalls.push(fields);

        return {
            ...fields,
            async save() {
                saveCalls.push(fields);
            },
        } as never;
    });
}

async function requestJson(app: express.Express, requestPath: string, options: { method: string; body?: unknown }): Promise<{ status: number; body: unknown }> {
    const server = await listen(app);
    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${requestPath}`, {
            method: options.method,
            headers: options.body === undefined ? undefined : { "content-type": "application/json" },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });

        return {
            status: response.status,
            body: await response.json(),
        };
    } finally {
        await close(server);
    }
}

async function listen(app: express.Express): Promise<Server> {
    const server = app.listen(0, "127.0.0.1");

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    return server;
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

function readJson<T>(filename: string): T {
    return JSON.parse(readFileSync(filename, "utf8")) as T;
}

type CloudAttachmentCreateCall = {
    user?: { id?: string };
    channel?: unknown;
    uploadFilename?: string;
    userAttachmentId?: string;
    userFilename?: string;
    userFileSize?: number;
    userIsClip?: boolean;
    userOriginalContentType?: string;
};

type JsonSchema = {
    $ref?: string;
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

type OpenApiDocument = {
    paths?: Record<
        string,
        {
            post?: {
                summary?: string;
                requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
                responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                security?: unknown;
                "x-permission-required"?: string;
            };
            get?: unknown;
            put?: unknown;
            patch?: unknown;
            delete?: unknown;
        }
    >;
};

type TestingManifest = {
    entries?: {
        id?: string;
        authMode?: string;
        sourceFile?: string;
        routeMetadata?: {
            requestBody?: string;
            permission?: string;
            responseBodies?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type HttpContractCatalog = {
    contracts?: {
        manifestId?: string;
        sourceFile?: string;
        routeMetadata?: {
            requestBody?: string;
            permission?: string;
            responses?: string[];
        };
        cases?: { id?: string }[];
    }[];
};

type SuiteCoverage = {
    groups?: {
        suites?: {
            id?: string;
            manifestIds?: string[];
        }[];
    }[];
};

type SourceRouteCatalogEntry = {
    method?: string;
    route?: string;
    route_name?: string;
    source?: string;
    request_schema_ref?: string;
    response_schema_refs?: string[];
};

type MissingRoutesReport = {
    missing_entries: {
        method?: string;
        route?: string;
        route_name?: string;
    }[];
};
