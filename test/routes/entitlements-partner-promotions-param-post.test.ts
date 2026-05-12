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
import { describe, test } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import partnerPromotionRouter, {
    PARTNER_PROMOTION_UNSUPPORTED_MESSAGE,
    claimPartnerPromotion,
    createPartnerPromotionUnsupportedError,
} from "../../src/api/routes/entitlements/partner-promotions/#param";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestId = "api:http:POST:/entitlements/partner-promotions/:param/";
const assignedPath = "/entitlements/partner-promotions/{param}";
const assignedRouteName = "PARTNER_PROMOTIONS";
const assignedSourceRouteName = "POST_ENTITLEMENTS_PARTNER_PROMOTIONS_PARAM";

type JsonSchema = {
    $ref?: string;
};

describe("POST /entitlements/partner-promotions/:param", () => {
    test("declares the assigned route identity and stays behind bearer auth", async () => {
        assert.equal(coveredManifestId, "api:http:POST:/entitlements/partner-promotions/:param/");
        assert.equal(assignedPath, "/entitlements/partner-promotions/{param}");
        assert.equal(assignedRouteName, "PARTNER_PROMOTIONS");
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/entitlements/partner-promotions/example-promo"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/entitlements/partner-promotions/example-promo"), false);
        assert.equal(isNoAuthorizationRoute("OPTIONS", "/api/v9/entitlements/partner-promotions/example-promo"), false);

        const response = await requestJson(createAuthenticatedApp(), "/entitlements/partner-promotions/example-promo");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("fails closed instead of fabricating partner-promotion entitlement state", async () => {
        const unsupportedError = createPartnerPromotionUnsupportedError();

        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, PARTNER_PROMOTION_UNSUPPORTED_MESSAGE);
        assert.throws(() => claimPartnerPromotion("example-promo"), {
            code: 0,
            httpStatus: 501,
            message: PARTNER_PROMOTION_UNSUPPORTED_MESSAGE,
        });

        const response = await requestJson(createRouteApp(), "/entitlements/partner-promotions/example-promo");

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: PARTNER_PROMOTION_UNSUPPORTED_MESSAGE,
        });
    });

    test("declares generated artifacts for only the owned POST method", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "entitlements", "partner-promotions", "#param.ts"), "utf8");
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: unknown;
                    options?: unknown;
                    post?: {
                        responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
                        security?: unknown;
                    };
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                id?: string;
                path?: string;
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
                path?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.match(routeSource, /summary:\s*"Claim Partner Promotion"/);
        assert.match(routeSource, /fails closed instead of fabricating an entitlement/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(get|options)\(/);

        const operation = openapi.paths?.["/entitlements/partner-promotions/{param}/"]?.post;
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/entitlements/partner-promotions/{param}/"]?.get, undefined);
        assert.equal(openapi.paths?.["/entitlements/partner-promotions/{param}/"]?.options, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.path, "/entitlements/partner-promotions/:param/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/entitlements/partner-promotions/#param.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [401, 501]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.path, "/entitlements/partner-promotions/:param/");
        assert.equal(contract?.sourceFile, "src/api/routes/entitlements/partner-promotions/#param.ts");
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [401, 501]);

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === assignedPath);
        assert.equal(sourceEntry?.route_name, assignedSourceRouteName);
        assert.equal(sourceEntry?.source, "src/api/routes/entitlements/partner-promotions/#param.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs, ["APIErrorResponse"]);
        assert.equal(
            sourceCatalog.some((entry) => (entry.method === "GET" || entry.method === "OPTIONS") && entry.route === assignedPath),
            false,
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === assignedPath && entry.route_name === assignedRouteName),
            false,
        );
    });
});

function createRouteApp() {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "100000000000000001";
        next();
    });
    app.use("/entitlements/partner-promotions/:param", partnerPromotionRouter);
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/entitlements/partner-promotions/:param", partnerPromotionRouter);
    app.use(ErrorHandler);

    return app;
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

async function requestJson(app: express.Express, path: string) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
            method: "POST",
        });

        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        await closeServer(server);
    }
}

async function closeServer(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
