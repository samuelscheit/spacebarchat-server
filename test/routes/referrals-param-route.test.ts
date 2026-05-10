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
import { ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import referralsRouter, { UNKNOWN_PREMIUM_REFERRAL, resolvePremiumReferral } from "../../src/api/routes/referrals/#referral_id";

const coveredManifestIds = ["api:http:GET:/referrals/:referral_id/"];

type JsonSchema = {
    $ref?: string;
    type?: string;
    required?: string[];
    properties?: Record<string, JsonSchema>;
};

describe("GET /referrals/:referral_id", () => {
    test("declares the referrals manifest route id covered by this suite", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/referrals/:referral_id/"]);
    });

    test("does not fabricate referral records without durable referral storage", () => {
        assert.equal(resolvePremiumReferral("1107800271637200936", "1044657759066525777"), undefined);
        assert.equal(UNKNOWN_PREMIUM_REFERRAL.httpStatus, 404);
        assert.equal(UNKNOWN_PREMIUM_REFERRAL.code, 0);
    });

    test("returns a conservative unknown referral error for unresolved authenticated lookups", async () => {
        const response = await requestJson(createRouteApp(), "/referrals/1107800271637200936");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: UNKNOWN_PREMIUM_REFERRAL.code,
            message: UNKNOWN_PREMIUM_REFERRAL.message,
        });
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    });

    test("declares source-backed metadata and remains bearer-authenticated", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "referrals", "#referral_id.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Premium Referral"/);
        assert.match(routeSource, /description:\s*"Returns a premium referral object for the given referral ID\."/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"PremiumReferralResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/referrals/1107800271637200936"), false);
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

        assert.deepEqual(schemas.PremiumReferralResponse.required, ["expires_at", "id", "referrer", "referrer_id", "subscription_trial", "trial_id", "user_id"]);
        assert.equal(schemas.PremiumReferralResponse.properties?.subscription_trial?.$ref, "#/definitions/PremiumReferralSubscriptionTrial");
        assert.equal(schemas.PremiumReferralResponse.properties?.referrer?.$ref, "#/definitions/PartialUser");
        assert.deepEqual(schemas.PremiumReferralSubscriptionTrial.required, ["id", "interval", "interval_count", "sku_id"]);

        const route = openapi.paths?.["/referrals/{referral_id}/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PremiumReferralResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "referral_id" && parameter.in === "path" && parameter.schema?.type === "string"),
            true,
        );

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/referrals/{referral_id}");
        assert.equal(sourceEntry?.source, "src/api/routes/referrals/#referral_id.ts");
        assert.equal(sourceEntry?.response_schema_refs?.includes("PremiumReferralResponse"), true);
        assert.equal(sourceEntry?.response_schema_refs?.includes("APIErrorResponse"), true);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/referrals/#referral_id.ts");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("PremiumReferralResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(404), true);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/referrals/:referral_id/");
        assert.equal(contract?.routeMetadata?.responses?.includes("PremiumReferralResponse"), true);
        assert.equal(contract?.routeMetadata?.responseStatuses?.includes(404), true);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/referrals/{param}" && entry.route_name === "GET_REFERRALS_REFERRAL_ID"),
            false,
        );
    });
});

function createRouteApp() {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "1044657759066525777";
        next();
    });
    app.use("/referrals/:referral_id", referralsRouter);
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
