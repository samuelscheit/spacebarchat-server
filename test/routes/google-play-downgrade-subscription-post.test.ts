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
import googlePlayDowngradeSubscriptionRouter, {
    GOOGLE_PLAY_DOWNGRADE_SUBSCRIPTION_UNSUPPORTED_MESSAGE,
    createGooglePlayDowngradeSubscriptionUnsupportedError,
} from "../../src/api/routes/google-play/downgrade-subscription";

const coveredManifestId = "api:http:POST:/google-play/downgrade-subscription/";
const assignedPath = "/google-play/downgrade-subscription";
const assignedRouteName = "DOWNGRADE_SUBSCRIPTION";

type JsonSchemaRef = {
    $ref?: string;
};

describe("POST /google-play/downgrade-subscription", () => {
    test("declares the assigned route identity and remains bearer-authenticated", async () => {
        assert.equal(coveredManifestId, "api:http:POST:/google-play/downgrade-subscription/");
        assert.equal(assignedPath, "/google-play/downgrade-subscription");
        assert.equal(assignedRouteName, "DOWNGRADE_SUBSCRIPTION");
        assert.equal(isNoAuthorizationRoute("POST", "/google-play/downgrade-subscription"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/google-play/downgrade-subscription"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/google-play/downgrade-subscription"), false);

        const response = await requestJson(createRouteApp({ authentication: true }), "/google-play/downgrade-subscription");

        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
    });

    test("fails closed instead of fabricating Google Play subscription state", async () => {
        const unsupportedError = createGooglePlayDowngradeSubscriptionUnsupportedError();

        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, GOOGLE_PLAY_DOWNGRADE_SUBSCRIPTION_UNSUPPORTED_MESSAGE);

        const response = await requestJson(createRouteApp(), "/google-play/downgrade-subscription");

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: GOOGLE_PLAY_DOWNGRADE_SUBSCRIPTION_UNSUPPORTED_MESSAGE,
        });
    });

    test("declares generated artifacts for only the owned POST method", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "google-play", "downgrade-subscription.ts"), "utf8");
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: unknown;
                    post?: {
                        requestBody?: unknown;
                        responses?: Record<string, { content?: Record<string, { schema?: JsonSchemaRef }> }>;
                        security?: unknown;
                    };
                    put?: unknown;
                    patch?: unknown;
                    delete?: unknown;
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
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(
            join(process.cwd(), "packages", "missing-routes", "missing.json"),
        );
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                coverage?: {
                    policyId?: string;
                    testTier?: string;
                };
                id?: string;
                path?: string;
                routeMetadata?: {
                    requestBody?: string;
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
                    requestBody?: string;
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));

        assert.match(routeSource, /summary:\s*"Downgrade Google Play Subscription"/);
        assert.match(routeSource, /Google Play Billing or persist Google purchase-token lineage/);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /requestBody:/);
        assert.doesNotMatch(routeSource, /router\.(?:get|put|patch|delete)\(/);
        assert.doesNotMatch(routeSource, /validate-purchase|verify-purchase-token/i);

        const route = openapi.paths?.["/google-play/downgrade-subscription/"];
        assert.equal(route?.post?.requestBody, undefined);
        assert.equal(route?.post?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.post?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.post?.security, [{ bearer: [] }]);
        assert.equal(route?.get, undefined);
        assert.equal(route?.put, undefined);
        assert.equal(route?.patch, undefined);
        assert.equal(route?.delete, undefined);

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "POST" && entry.route === assignedPath),
            {
                method: "POST",
                response_schema_refs: ["APIErrorResponse"],
                route: assignedPath,
                route_name: "POST_GOOGLE_PLAY_DOWNGRADE_SUBSCRIPTION",
                source: "src/api/routes/google-play/downgrade-subscription.ts",
            },
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === assignedPath && entry.route_name === assignedRouteName),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.path, `${assignedPath}/`);
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/google-play/downgrade-subscription.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.coverage?.policyId, "api-google-play-commerce");
        assert.equal(manifestEntry?.coverage?.testTier, "stateful-domain");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, undefined);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [401, 501]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.requestBody, undefined);
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [401, 501]);
    });
});

function createRouteApp(options: { authentication?: boolean } = {}) {
    const app = express();

    if (options.authentication) app.use(Authentication);
    else {
        app.use((req, _res, next) => {
            req.user_id = "100000000000000001";
            next();
        });
    }
    app.use("/google-play/downgrade-subscription", googlePlayDowngradeSubscriptionRouter);
    app.use(ErrorHandler);

    return app;
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

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
}
