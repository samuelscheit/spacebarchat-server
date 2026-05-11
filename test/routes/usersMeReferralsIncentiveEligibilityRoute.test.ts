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
import { describe, test } from "node:test";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import incentiveEligibilityRouter, { getPremiumReferralIncentiveEligibility } from "../../src/api/routes/users/@me/referrals/incentive-eligibility";

const coveredManifestIds = ["api:http:GET:/users/@me/referrals/incentive-eligibility/"];

type JsonSchema = {
    $ref?: string;
    type?: string;
    required?: string[];
    properties?: Record<string, JsonSchema>;
};

describe("GET /users/@me/referrals/incentive-eligibility", () => {
    test("declares the current-user referral incentive eligibility manifest route id covered by this suite", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/referrals/incentive-eligibility/"]);
    });

    test("fails closed without durable referral incentive state", () => {
        assert.deepEqual(getPremiumReferralIncentiveEligibility("1044657759066525777"), {
            is_eligible_for_incentive: false,
        });
    });

    test("returns a conservative authenticated compatibility response", async () => {
        const response = await requestJson(createRouteApp(), "/users/@me/referrals/incentive-eligibility");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            is_eligible_for_incentive: false,
        });
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    });

    test("stays behind bearer auth and declares source-backed metadata", async () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "referrals", "incentive-eligibility.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Premium Referral Incentive Eligibility"/);
        assert.match(
            routeSource,
            /description:\s*"Returns a subset of the premium referral eligibility object for the user with their eligibility for a personal discount upon referral redemption\."/s,
        );
        assert.match(routeSource, /200:\s*\{\s*body:\s*"PremiumReferralIncentiveEligibilityResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/referrals/incentive-eligibility"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/users/@me/referrals/incentive-eligibility/"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/users/@me/referrals/incentive-eligibility"), false);

        const response = await requestJson(createRouteApp({ authentication: true }), "/users/@me/referrals/incentive-eligibility");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("generates response schema, route catalogs, and manifest metadata", () => {
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; in?: string; schema?: JsonSchema }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                source?: string;
                response_schema_refs?: string[];
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                    hasQuery?: boolean;
                };
            }[];
        }>(join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                manifestId?: string;
                authMode?: string;
                path?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.deepEqual(schemas.PremiumReferralIncentiveEligibilityResponse.required, ["is_eligible_for_incentive"]);
        assert.equal(schemas.PremiumReferralIncentiveEligibilityResponse.properties?.is_eligible_for_incentive?.type, "boolean");

        const route = openapi.paths?.["/users/@me/referrals/incentive-eligibility/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PremiumReferralIncentiveEligibilityResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.parameters?.length ?? 0, 0);

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/referrals/incentive-eligibility");
        assert.equal(sourceEntry?.source, "src/api/routes/users/@me/referrals/incentive-eligibility.ts");
        assert.equal(sourceEntry?.response_schema_refs?.includes("PremiumReferralIncentiveEligibilityResponse"), true);
        assert.equal(sourceEntry?.response_schema_refs?.includes("APIErrorResponse"), true);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/referrals/incentive-eligibility.ts");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, false);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("PremiumReferralIncentiveEligibilityResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/users/@me/referrals/incentive-eligibility/");
        assert.equal(contract?.routeMetadata?.responses?.includes("PremiumReferralIncentiveEligibilityResponse"), true);
        assert.equal(contract?.routeMetadata?.responseStatuses?.includes(401), true);

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) =>
                    entry.method === "GET" && entry.route === "/users/@me/referrals/incentive-eligibility" && entry.route_name === "GET_USERS__ME_REFERRALS_INCENTIVE_ELIGIBILITY",
            ),
            false,
        );
    });
});

function createRouteApp(options: { authentication?: boolean } = {}) {
    const app = express();

    if (options.authentication) {
        app.use(Authentication);
    } else {
        app.use((req, _res, next) => {
            req.user_id = "1044657759066525777";
            next();
        });
    }
    app.use("/users/@me/referrals/incentive-eligibility", incentiveEligibilityRouter);
    app.use(ErrorHandler);

    return app;
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

async function requestJson(app: express.Express, path: string) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`);

        return {
            status: response.status,
            headers: response.headers,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
