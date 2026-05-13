process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar-test";
process.env.LOG_ROUTES = "false";

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import express from "express";
import { BodyParser, ErrorHandler } from "../../middlewares";
import reportingRouter from "../../routes/reporting";

const postManifestId = "api:http:POST:/reporting/:type";

interface JsonResponse {
    statusCode: number | undefined;
    body: unknown;
}

interface ErrorResponse {
    code: number;
    errors: Record<string, { _errors: { code: string }[] }>;
}

let server: http.Server;
let baseUrl: string;

const messageMenu = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "temp_report_menu_responses", "message.json"), "utf-8"));

function createMessageReportBody(overrides: Record<string, unknown> = {}) {
    return {
        version: messageMenu.version,
        variant: messageMenu.variant,
        name: "message",
        language: "en-US",
        breadcrumbs: [messageMenu.root_node_id, 98],
        channel_id: "100000000000000001",
        message_id: "100000000000000002",
        ...overrides,
    };
}

function postJson(url: string, body: unknown): Promise<JsonResponse> {
    const payload = JSON.stringify(body);

    return new Promise((resolve, reject) => {
        const req = http.request(
            url,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "content-length": Buffer.byteLength(payload),
                },
            },
            (res) => {
                let data = "";
                res.setEncoding("utf8");
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try {
                        resolve({
                            statusCode: res.statusCode,
                            body: data ? JSON.parse(data) : null,
                        });
                    } catch (error) {
                        reject(error);
                    }
                });
            },
        );

        req.on("error", reject);
        req.end(payload);
    });
}

before(async () => {
    const app = express();
    app.use(BodyParser({ inflate: true, limit: "1mb" }));
    app.use("/reporting", reportingRouter);
    app.use(ErrorHandler);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            resolve();
        });
    });
    const address = server.address();
    assert(address && typeof address === "object");
    baseUrl = `http://${address.address}:${address.port}`;
});

after(async () => {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });
});

describe("report submissions", () => {
    test("returns no content after a valid submission", async () => {
        const response = await postJson(`${baseUrl}/reporting/message`, createMessageReportBody());

        assert.equal(response.statusCode, 204);
        assert.equal(response.body, null);
    });

    test("rejects submissions for a stale menu version", async () => {
        const response = await postJson(`${baseUrl}/reporting/message`, createMessageReportBody({ version: "stale" }));
        const body = response.body as ErrorResponse;

        assert.equal(response.statusCode, 400);
        assert.equal(body.code, 50035);
        assert.equal(body.errors.version._errors[0].code, "INVALID_REPORT_MENU_VERSION");
    });

    test("rejects breadcrumbs that are not reachable from the report menu root", async () => {
        const response = await postJson(`${baseUrl}/reporting/message`, createMessageReportBody({ breadcrumbs: [messageMenu.root_node_id, 74] }));
        const body = response.body as ErrorResponse;

        assert.equal(response.statusCode, 400);
        assert.equal(body.code, 50035);
        assert.equal(body.errors.breadcrumbs._errors[0].code, "INVALID_REPORT_MENU_BREADCRUMBS_PATH");
    });

    test("rejects breadcrumbs that do not start at the report menu root", async () => {
        const response = await postJson(`${baseUrl}/reporting/message`, createMessageReportBody({ breadcrumbs: [17] }));
        const body = response.body as ErrorResponse;

        assert.equal(response.statusCode, 400);
        assert.equal(body.code, 50035);
        assert.equal(body.errors.breadcrumbs._errors[0].code, "INVALID_REPORT_MENU_BREADCRUMBS_PATH");
    });

    test("rejects unknown report menu types before accepting a submission", async () => {
        const response = await postJson(`${baseUrl}/reporting/not_a_report_type`, createMessageReportBody());
        const body = response.body as { code?: number; message?: string };

        assert.equal(response.statusCode, 400);
        assert.equal(body.code, 400);
        assert.match(body.message ?? "", /Unknown report menu type/);
    });

    test("generated artifacts declare the assigned parameterized POST route", () => {
        const routeSource = fs.readFileSync(path.join(process.cwd(), "src", "api", "routes", "reporting", "index.ts"), "utf8");
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    post?: {
                        requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                    };
                }
            >;
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                source?: string;
                request_schema_ref?: string;
                response_schema_refs?: string[];
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ routes?: string[]; missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(
            path.join("packages", "missing-routes", "missing.json"),
        );
        const manifest = readJson<{
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
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{
            contracts?: {
                manifestId?: string;
                sourceFile?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("test", "generated", "http-contracts.json"));

        assert.match(routeSource, /router\.post\(\s*["']\/:type["']/);

        const openapiRoute = openapi.paths?.["/reporting/{type}"]?.post;
        assert.equal(openapiRoute?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/CreateReportSchema");
        assert.equal(openapiRoute?.responses?.["204"]?.content, undefined);
        assert.equal(openapiRoute?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/reporting/{type}");
        assert.equal(sourceRoute?.route_name, "POST_REPORTING_TYPE");
        assert.equal(sourceRoute?.source, "src/api/routes/reporting/index.ts");
        assert.equal(sourceRoute?.request_schema_ref, "CreateReportSchema");
        assert.deepEqual(sourceRoute?.response_schema_refs, ["APIErrorResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/reporting/{param}" && entry.route_name === "POST_REPORTING_TYPE"),
            false,
        );
        assert.equal(missingRoutes.routes?.includes("/reporting/{param}"), false);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === postManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/reporting/index.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "CreateReportSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [204, 400, 401]);

        const contractEntry = contractMatrix.contracts?.find((contract) => contract.manifestId === postManifestId);
        assert.equal(contractEntry?.sourceFile, "src/api/routes/reporting/index.ts");
        assert.equal(contractEntry?.routeMetadata?.requestBody, "CreateReportSchema");
        assert.deepEqual(contractEntry?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contractEntry?.routeMetadata?.responseStatuses, [204, 400, 401]);
    });
});

function readJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}
