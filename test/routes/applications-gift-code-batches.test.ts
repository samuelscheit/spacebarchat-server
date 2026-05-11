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
import express from "express";
import { DiscordApiErrors } from "@spacebar/util";
import {
    createApplicationGiftCodeBatchesRouter,
    getApplicationGiftCodeBatches,
    serializeApplicationGiftCodeBatch,
    type ApplicationGiftCodeBatchRepositories,
} from "../../src/api/routes/applications/#application_id/gift-code-batches/index";
import {
    createApplicationGiftCodeBatchRouter,
    getApplicationGiftCodeBatchCsv,
    serializeGiftCodeBatchCsv,
    type GiftCodeBatchCsvRepositories,
} from "../../src/api/routes/applications/#application_id/gift-code-batches/#gift_code_batch_id";

const collectionManifestId = "api:http:GET:/applications/:application_id/gift-code-batches/";
const csvManifestId = "api:http:GET:/applications/:application_id/gift-code-batches/:gift_code_batch_id/";
const coveredManifestIds = [collectionManifestId, csvManifestId];
const collectionRoutePath = "/applications/{application_id}/gift-code-batches";
const collectionSourceFile = "src/api/routes/applications/#application_id/gift-code-batches/index.ts";
const csvRoutePath = "/applications/{application_id}/gift-code-batches/{gift_code_batch_id}";
const csvSourceFile = "src/api/routes/applications/#application_id/gift-code-batches/#gift_code_batch_id.ts";

type JsonSchema = {
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
    $ref?: string;
};

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

function createCsvApp(userId = "owner", repositories: GiftCodeBatchCsvRepositories = {}) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/applications/:application_id/gift-code-batches/:gift_code_batch_id", createApplicationGiftCodeBatchRouter(repositories));
    app.use((error: { code?: number; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 500).json({
            code: error.code,
            message: error.message,
        });
    });

    return app;
}

function createBatchesApp(userId = "owner", repositories: ApplicationGiftCodeBatchRepositories = {}) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/applications/:application_id/gift-code-batches", createApplicationGiftCodeBatchesRouter(repositories));
    app.use((error: { code?: number; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 500).json({
            code: error.code,
            message: error.message,
        });
    });

    return app;
}

async function request(app: express.Express, path: string) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        return await fetch(`http://127.0.0.1:${port}${path}`);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /applications/:application_id/gift-code-batches", () => {
    test("authorizes the caller and returns stored gift code batches in stable order", async (t) => {
        assert.deepEqual(coveredManifestIds, [collectionManifestId, csvManifestId]);
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
            })),
        };
        const batchRepository = {
            find: t.mock.fn(async (_options: unknown) => [
                {
                    id: "batch-a",
                    sku_id: "sku-a",
                    amount: 10,
                    description: "Holiday Giveaway",
                    entitlement_branches: ["branch-a"],
                    entitlement_starts_at: new Date("2026-01-02T03:04:05.000Z"),
                    entitlement_ends_at: "2026-02-03T04:05:06.000Z",
                },
                {
                    id: "batch-b",
                    sku_id: "sku-b",
                    amount: 2,
                    description: null,
                    entitlement_branches: null,
                    entitlement_starts_at: null,
                    entitlement_ends_at: null,
                },
            ]),
        };

        const batches = await getApplicationGiftCodeBatches("app", "owner", { applicationRepository, batchRepository });

        assert.deepEqual(batches, [
            {
                id: "batch-a",
                sku_id: "sku-a",
                amount: 10,
                description: "Holiday Giveaway",
                entitlement_branches: ["branch-a"],
                entitlement_starts_at: "2026-01-02T03:04:05.000Z",
                entitlement_ends_at: "2026-02-03T04:05:06.000Z",
            },
            {
                id: "batch-b",
                sku_id: "sku-b",
                amount: 2,
            },
        ]);
        assert.deepEqual(applicationRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: "app" },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });
        assert.deepEqual(batchRepository.find.mock.calls[0].arguments[0], {
            where: {
                application_id: "app",
            },
            select: {
                id: true,
                sku_id: true,
                amount: true,
                description: true,
                entitlement_branches: true,
                entitlement_starts_at: true,
                entitlement_ends_at: true,
            },
            order: {
                id: "ASC",
            },
        });
    });

    test("returns an empty list when the application has no stored gift code batches", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
            })),
        };
        const batchRepository = {
            find: t.mock.fn(async (_options: unknown) => []),
        };

        assert.deepEqual(await getApplicationGiftCodeBatches("app", "owner", { applicationRepository, batchRepository }), []);
    });

    test("serializes optional batch fields only when durable values exist", () => {
        assert.deepEqual(
            serializeApplicationGiftCodeBatch({
                id: "batch",
                sku_id: "sku",
                amount: 1,
                description: undefined,
                entitlement_branches: undefined,
                entitlement_starts_at: undefined,
                entitlement_ends_at: undefined,
            }),
            {
                id: "batch",
                sku_id: "sku",
                amount: 1,
            },
        );
    });

    test("returns JSON from the mounted collection route", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
            })),
        };
        const batchRepository = {
            find: t.mock.fn(async (_options: unknown) => [
                {
                    id: "batch",
                    sku_id: "sku",
                    amount: 3,
                    description: "Preview codes",
                    entitlement_branches: ["branch"],
                },
            ]),
        };

        const response = await request(createBatchesApp("owner", { applicationRepository, batchRepository }), "/applications/app/gift-code-batches");

        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/);
        assert.deepEqual(await response.json(), [
            {
                id: "batch",
                sku_id: "sku",
                amount: 3,
                description: "Preview codes",
                entitlement_branches: ["branch"],
            },
        ]);
    });

    test("returns the application authorization error for non-owner non-team callers", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
            })),
        };
        const batchRepository = {
            find: t.mock.fn(async (_options: unknown) => {
                throw new Error("batch lookup should not run before authorization");
            }),
        };

        const response = await request(createBatchesApp("intruder", { applicationRepository, batchRepository }), "/applications/app/gift-code-batches");
        const body = (await response.json()) as { code: number; message: string };

        assert.equal(response.status, 400);
        assert.equal(body.code, DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code);
    });

    test("declares source-backed route metadata", () => {
        const routeSource = readFileSync(join(process.cwd(), collectionSourceFile), "utf8");

        assert.match(routeSource, /summary:\s*"Get Application Gift Code Batches"/);
        assert.match(routeSource, /description:\s*"Returns stored gift code batches for the given application\."/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ApplicationGiftCodeBatchesResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("generates response schema, source catalog, OpenAPI, manifest, contract, coverage, and missing-route metadata", () => {
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                id?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
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
                sourceFile?: string;
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<unknown>(join(process.cwd(), "test", "generated", "suite-coverage.json"));
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        const responseSchema = schemas.ApplicationGiftCodeBatchesResponse;
        assert.equal(responseSchema.type, "array");
        assert.equal(responseSchema.items?.$ref, "#/definitions/ApplicationGiftCodeBatchResponse");

        const batchSchema = schemas.ApplicationGiftCodeBatchResponse;
        assert.deepEqual(batchSchema.required, ["amount", "id", "sku_id"]);
        assert.equal(batchSchema.properties?.id?.type, "string");
        assert.equal(batchSchema.properties?.sku_id?.type, "string");
        assert.equal(batchSchema.properties?.amount?.type, "integer");
        assert.equal(batchSchema.properties?.description?.type, "string");
        assert.equal(batchSchema.properties?.entitlement_branches?.items?.type, "string");
        assert.equal(batchSchema.properties?.entitlement_starts_at?.type, "string");
        assert.equal(batchSchema.properties?.entitlement_ends_at?.type, "string");

        const route = openapi.paths?.["/applications/{application_id}/gift-code-batches/"]?.get;
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationGiftCodeBatchesResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === collectionRoutePath);
        assert.equal(sourceEntry?.route_name, "GET_APPLICATIONS_APPLICATION_ID_GIFT_CODE_BATCHES");
        assert.equal(sourceEntry?.source, collectionSourceFile);
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ApplicationGiftCodeBatchesResponse"]);

        const csvSourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === csvRoutePath);
        assert.equal(csvSourceEntry?.route_name, "GET_APPLICATIONS_APPLICATION_ID_GIFT_CODE_BATCHES_GIFT_CODE_BATCH_ID");
        assert.equal(csvSourceEntry?.source, csvSourceFile);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === collectionManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, collectionSourceFile);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "ApplicationGiftCodeBatchesResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 400, 401, 404]);

        const csvManifestEntry = manifest.entries?.find((entry) => entry.id === csvManifestId);
        assert.equal(csvManifestEntry?.sourceFile, csvSourceFile);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === collectionManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.sourceFile, collectionSourceFile);
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "ApplicationGiftCodeBatchesResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401, 404]);
        assert.ok(JSON.stringify(suiteCoverage).includes(collectionManifestId));

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) =>
                    entry.method === "GET" && entry.route === "/applications/{param}/gift-code-batches" && entry.route_name === "GET_APPLICATIONS_APPLICATION_ID_GIFT_CODE_BATCHES",
            ),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) =>
                    entry.method === "POST" &&
                    entry.route === "/applications/{param}/gift-code-batches" &&
                    entry.route_name === "POST_APPLICATIONS_APPLICATION_ID_GIFT_CODE_BATCHES",
            ),
            true,
        );
    });
});

describe("GET /applications/:application_id/gift-code-batches/:gift_code_batch_id", () => {
    test("serializes gift code CSV with standard escaping", () => {
        assert.equal(coveredManifestIds.includes(csvManifestId), true);
        assert.equal(
            serializeGiftCodeBatchCsv([{ code: "plain" }, { code: 'quote"code' }, { code: "comma,code" }, { code: "line\ncode" }]),
            'code\r\nplain\r\n"quote""code"\r\n"comma,code"\r\n"line\ncode"\r\n',
        );
    });

    test("authorizes the caller, verifies the batch belongs to the application, and exports stored codes", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
            })),
        };
        const batchRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                id: "batch",
            })),
        };
        const codeRepository = {
            find: t.mock.fn(async (_options: unknown) => [{ code: "alpha" }, { code: "beta" }]),
        };

        const csv = await getApplicationGiftCodeBatchCsv("app", "batch", "owner", {
            applicationRepository,
            batchRepository,
            codeRepository,
        });

        assert.equal(csv, "code\r\nalpha\r\nbeta\r\n");
        assert.deepEqual(batchRepository.findOne.mock.calls[0].arguments[0], {
            where: {
                id: "batch",
                application_id: "app",
            },
            select: {
                id: true,
            },
        });
        assert.deepEqual(codeRepository.find.mock.calls[0].arguments[0], {
            where: {
                application_id: "app",
                batch_id: "batch",
            },
            select: {
                code: true,
            },
            order: {
                code: "ASC",
            },
        });
    });

    test("throws unknown gift code when the requested application batch does not exist", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
            })),
        };
        const batchRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        await assert.rejects(
            () =>
                getApplicationGiftCodeBatchCsv("app", "missing", "owner", {
                    applicationRepository,
                    batchRepository,
                    codeRepository: {
                        find: async () => {
                            throw new Error("gift code lookup should not run for missing batches");
                        },
                    },
                }),
            (error) => error === DiscordApiErrors.UNKNOWN_GIFT_CODE,
        );
    });

    test("returns a CSV download from the mounted route", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
            })),
        };
        const batchRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                id: "batch",
            })),
        };
        const codeRepository = {
            find: t.mock.fn(async (_options: unknown) => [{ code: "alpha" }, { code: "beta" }]),
        };

        const response = await request(createCsvApp("owner", { applicationRepository, batchRepository, codeRepository }), "/applications/app/gift-code-batches/batch");

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
        assert.equal(response.headers.get("content-disposition"), 'attachment; filename="gift-code-batch-batch.csv"');
        assert.equal(await response.text(), "code\r\nalpha\r\nbeta\r\n");
    });

    test("returns the gift code error when the mounted route cannot find the batch", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
            })),
        };
        const batchRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };
        const codeRepository = {
            find: t.mock.fn(async (_options: unknown) => {
                throw new Error("gift code lookup should not run for missing batches");
            }),
        };

        const response = await request(createCsvApp("owner", { applicationRepository, batchRepository, codeRepository }), "/applications/app/gift-code-batches/missing");
        const body = (await response.json()) as { code: number; message: string };

        assert.equal(response.status, 400);
        assert.equal(body.code, DiscordApiErrors.UNKNOWN_GIFT_CODE.code);
    });

    test("returns the application authorization error for non-owner non-team callers", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
            })),
        };
        const batchRepository = {
            findOne: t.mock.fn(async (_options: unknown) => {
                throw new Error("batch lookup should not run before authorization");
            }),
        };

        const response = await request(createCsvApp("intruder", { applicationRepository, batchRepository }), "/applications/app/gift-code-batches/batch");
        const body = (await response.json()) as { code: number; message: string };

        assert.equal(response.status, 400);
        assert.equal(body.code, DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code);
    });
});
