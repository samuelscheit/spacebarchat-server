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
import path from "node:path";
import { describe, test } from "node:test";
import { Authentication, ErrorHandler } from "@spacebar/api";
import express from "express";
import userIdentityVerificationRouter, {
    USER_IDENTITY_VERIFICATION_UNSUPPORTED_MESSAGE,
    createUserIdentityVerificationUnsupportedError,
} from "../../src/api/routes/users/@me/identity/verification";

const coveredManifestIds = ["api:http:GET:/users/@me/identity/verification/"];

type JsonSchema = {
    $ref?: string;
};

describe("GET /users/@me/identity/verification", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/identity/verification/"]);
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(Authentication);
        app.use("/users/@me/identity/verification", userIdentityVerificationRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/users/@me/identity/verification");

        assert.equal(response.status, 401);
        assert.equal(response.body.code, 401);
        assert.equal(response.body.message, "Error: Missing Authorization Header");
    });

    test("fails closed without fabricating a Stripe-backed identity verification attempt", async () => {
        const app = setupAuthenticatedRoute();
        const response = await requestJson(app, "/users/@me/identity/verification");

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: USER_IDENTITY_VERIFICATION_UNSUPPORTED_MESSAGE,
        });
    });

    test("uses an explicit unsupported-provider API error", () => {
        const error = createUserIdentityVerificationUnsupportedError();

        assert.equal(error.code, 0);
        assert.equal(error.httpStatus, 501);
        assert.equal(error.message, USER_IDENTITY_VERIFICATION_UNSUPPORTED_MESSAGE);
    });

    test("documents route metadata, deprecation, and local support limits", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "identity", "verification.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get User Identity Verification"/);
        assert.match(routeSource, /This Discord endpoint is deprecated/);
        assert.match(routeSource, /does not currently persist that state or integrate with an identity provider/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /200:\s*\{/);
        assert.doesNotMatch(routeSource, /redirect_url/);
    });

    test("generates source catalog, missing-route, OpenAPI, testing manifest, contract, and suite coverage metadata", () => {
        const sourceCatalog = JSON.parse(
            readFileSync(path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            response_schema_refs?: string[];
            route?: string;
            route_name?: string;
            source?: string;
        }[];
        const missingRoutes = JSON.parse(readFileSync(path.join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: {
                method?: string;
                route?: string;
            }[];
        };
        const openapi = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            components?: { schemas?: Record<string, JsonSchema> };
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                        summary?: string;
                    };
                }
            >;
        };
        const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                authMode?: string;
                id?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        };
        const contracts = JSON.parse(readFileSync(path.join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const suiteCoverage = JSON.parse(readFileSync(path.join(process.cwd(), "test", "generated", "suite-coverage.json"), "utf8")) as unknown;

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/identity/verification");
        assert.equal(sourceEntry?.route_name, "GET_USERS__ME_IDENTITY_VERIFICATION");
        assert.equal(sourceEntry?.source, "src/api/routes/users/@me/identity/verification.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs, ["APIErrorResponse"]);
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "POST" && entry.route === "/users/@me/identity/verification"),
            false,
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/@me/identity/verification"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/users/@me/identity/verification"),
            true,
        );

        const route = openapi.paths?.["/users/@me/identity/verification/"]?.get;
        assert.equal(route?.summary, "Get User Identity Verification");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.responses?.["200"], undefined);
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.ok(openapi.components?.schemas?.APIErrorResponse);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/identity/verification.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [401, 501]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [401, 501]);
        assert.ok(JSON.stringify(suiteCoverage).includes(coveredManifestIds[0]));
    });
});

function setupAuthenticatedRoute() {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/users/@me/identity/verification", userIdentityVerificationRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        await closeServer(server);
    }
}

async function closeServer(server: ReturnType<express.Express["listen"]>) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
