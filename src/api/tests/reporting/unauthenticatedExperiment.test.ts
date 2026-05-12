process.env.LOG_ROUTES = "false";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import express from "express";
import { ErrorHandler } from "../../middlewares";
import unauthenticatedExperimentRouter, {
    createUnauthenticatedDsaExperimentUnsupportedError,
    UNAUTHENTICATED_DSA_EXPERIMENT_UNSUPPORTED_MESSAGE,
} from "../../routes/reporting/unauthenticated/experiment";

let server: http.Server;
let baseUrl: string;
const postManifestId = "api:http:POST:/reporting/unauthenticated/experiment/";

async function requestExperiment(method: "GET" | "POST") {
    const response = await fetch(`${baseUrl}/reporting/unauthenticated/experiment`, {
        method,
        headers: {
            accept: "application/json",
        },
    });

    return {
        response,
        body: (await response.json()) as unknown,
    };
}

before(async () => {
    const app = express();
    app.use("/reporting/unauthenticated/experiment", unauthenticatedExperimentRouter);
    app.use(ErrorHandler);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address() as AddressInfo | null;
    assert(address);
    baseUrl = `http://${address.address}:${address.port}`;
});

after(async () => {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
});

describe("unauthenticated reporting experiment", () => {
    test("GET returns an empty eligibility object", async () => {
        const { response, body } = await requestExperiment("GET");

        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
        assert.deepEqual(body, {});
    });

    test("POST fails closed without a DSA experiment provider", async () => {
        const unsupportedError = createUnauthenticatedDsaExperimentUnsupportedError();

        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, UNAUTHENTICATED_DSA_EXPERIMENT_UNSUPPORTED_MESSAGE);

        const { response, body } = await requestExperiment("POST");

        assert.equal(response.status, 501);
        assert.deepEqual(body, {
            code: 0,
            message: UNAUTHENTICATED_DSA_EXPERIMENT_UNSUPPORTED_MESSAGE,
        });
    });

    test("generated artifacts declare the assigned public POST compatibility route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "reporting", "unauthenticated", "experiment.ts"), "utf8");
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: unknown;
                    post?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
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
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("test", "generated", "http-contracts.json"));

        assert.match(routeSource, /router\.post\(\s*["']\/["']/);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);

        const openapiRoute = openapi.paths?.["/reporting/unauthenticated/experiment/"]?.post;
        assert.equal(openapiRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.security, undefined);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/reporting/unauthenticated/experiment");
        assert.equal(sourceRoute?.route_name, "POST_REPORTING_UNAUTHENTICATED_EXPERIMENT");
        assert.equal(sourceRoute?.source, "src/api/routes/reporting/unauthenticated/experiment.ts");
        assert.equal(sourceRoute?.request_schema_ref, undefined);
        assert.deepEqual(sourceRoute?.response_schema_refs, ["APIErrorResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "POST" && entry.route === "/reporting/unauthenticated/experiment" && entry.route_name === "DSA_EXPERIMENT_UNAUTHENTICATED",
            ),
            false,
        );
        assert.equal(missingRoutes.routes?.includes("/reporting/unauthenticated/experiment"), false);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === postManifestId);
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/reporting/unauthenticated/experiment.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [501]);

        const contractEntry = contractMatrix.contracts?.find((contract) => contract.manifestId === postManifestId);
        assert.equal(contractEntry?.sourceFile, "src/api/routes/reporting/unauthenticated/experiment.ts");
        assert.deepEqual(contractEntry?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contractEntry?.routeMetadata?.responseStatuses, [501]);
    });
});

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
}
