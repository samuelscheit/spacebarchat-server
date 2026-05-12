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
import path from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { createDefaultReadyUserConsents, createDefaultUserConsentsResponse } from "@spacebar/util";
import { isNoAuthorizationRoute } from "../../src/api/middlewares";
import consentRouter, { buildUserConsentsResponse } from "../../src/api/routes/users/@me/consent";

describe("GET /users/@me/consent", () => {
    test("returns the conservative current-user consent state used by READY", async () => {
        assert.deepEqual(createDefaultReadyUserConsents(), {
            personalization: {
                consented: false,
            },
        });
        assert.deepEqual(createDefaultUserConsentsResponse(), {
            personalization: {
                consented: false,
            },
            usage_statistics: {
                consented: false,
            },
        });

        const first = buildUserConsentsResponse("viewer");
        const second = buildUserConsentsResponse("viewer");

        assert.notEqual(first, second);
        assert.notEqual(first.personalization, second.personalization);
        assert.notEqual(first.usage_statistics, second.usage_statistics);

        const app = express();
        app.use((req, _res, next) => {
            req.user_id = "viewer";
            next();
        });
        app.use("/users/@me/consent", consentRouter);

        const { server, baseUrl } = await listen(app);
        try {
            const response = await fetch(`${baseUrl}/users/@me/consent`);

            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), {
                personalization: {
                    consented: false,
                },
                usage_statistics: {
                    consented: false,
                },
            });
        } finally {
            await close(server);
        }
    });

    test("stays behind bearer authentication and leaves consent mutation unimplemented", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/consent"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/users/@me/consent"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/users/@me/consent"), false);

        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "consent.ts"), "utf-8");
        assert.match(routeSource, /summary:\s*"Get User Consents"/);
        assert.match(routeSource, /body:\s*"UserConsentsResponse"/);
        assert.doesNotMatch(routeSource, /router\.post\(/);
    });

    test("is present in regenerated schemas, route artifacts, contracts, and suite coverage", () => {
        const schemas = readJson<
            Record<
                string,
                {
                    required?: string[];
                    properties?: Record<string, { $ref?: string; type?: string }>;
                    type?: string;
                }
            >
        >(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    post?: unknown;
                }
            >;
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(path.join("packages", "missing-routes", "missing.json"));
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
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{ contracts?: { manifestId?: string; routeMetadata?: { responses?: string[]; responseStatuses?: number[] } }[] }>(
            path.join("test", "generated", "http-contracts.json"),
        );
        const suiteCoverage = readJson<{ groups?: { suites?: { id?: string; manifestIds?: string[]; testFiles?: string[] }[] }[] }>(
            path.join("test", "generated", "suite-coverage.json"),
        );

        assert.equal(schemas.UserConsentStatusResponse?.type, "object");
        assert.deepEqual(schemas.UserConsentStatusResponse?.required, ["consented"]);
        assert.equal(schemas.UserConsentStatusResponse?.properties?.consented?.type, "boolean");
        assert.deepEqual(schemas.UserConsentsResponse?.required?.sort(), ["personalization", "usage_statistics"]);
        assert.equal(schemas.UserConsentsResponse?.properties?.personalization?.$ref, "#/definitions/UserConsentStatusResponse");
        assert.equal(schemas.UserConsentsResponse?.properties?.usage_statistics?.$ref, "#/definitions/UserConsentStatusResponse");

        const openapiRoute = openapi.paths?.["/users/@me/consent/"];
        assert.deepEqual(openapiRoute?.get?.security, [{ bearer: [] }]);
        assert.equal(openapiRoute?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UserConsentsResponse");
        assert.equal(openapiRoute?.get?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.post, undefined);

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/consent"),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "UserConsentsResponse"],
                route: "/users/@me/consent",
                route_name: "GET_USERS__ME_CONSENT",
                source: "src/api/routes/users/@me/consent.ts",
            },
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/@me/consent"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/users/@me/consent"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/users/@me/consent/");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/consent.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "UserConsentsResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401],
        );

        const contract = contractMatrix.contracts?.find((entry) => entry.manifestId === "api:http:GET:/users/@me/consent/");
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "UserConsentsResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401],
        );

        const usersSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "users");
        assert.ok(usersSuite?.manifestIds?.includes("api:http:GET:/users/@me/consent/"));
        assert.ok(usersSuite?.testFiles?.includes("test/scenarios/users-profile-settings.test.ts"));
    });
});

function readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf-8")) as T;
}

async function listen(app: express.Express) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    const address = server.address();
    assert(address && typeof address === "object");

    return {
        server,
        baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    };
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
