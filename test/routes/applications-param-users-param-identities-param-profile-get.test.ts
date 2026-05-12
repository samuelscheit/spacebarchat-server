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
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import type { UserApplicationProfileResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import {
    assertOAuthApplicationProfileToken,
    createUserApplicationProfileRouter,
    getLocalUserApplicationProfile,
    getOAuthApplicationProfileApplicationId,
    type UserApplicationProfileProvider,
} from "../../src/api/routes/applications/#application_id/users/#user_id/identities/#external_user_id/profile";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/applications/:application_id/users/:user_id/identities/:external_user_id/profile/"];
const assignedPath = "/applications/{application_id}/users/{user_id}/identities/{external_user_id}/profile";
const assignedMissingPath = "/applications/{param}/users/{param}/identities/{param}/profile";
const assignedRouteName = "GET_APPLICATIONS_APPLICATION_ID_USERS_USER_ID_IDENTITIES_EXTERNAL_USER_ID_PROFILE";
const applicationId = "100000000000000007";
const userId = "100000000000000008";
const externalUserId = "external-user";

type JsonSchema = {
    $ref?: string;
    additionalProperties?: boolean | JsonSchema;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

describe("GET /applications/:application_id/users/:user_id/identities/:external_user_id/profile", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/applications/:application_id/users/:user_id/identities/:external_user_id/profile/"]);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v10/applications/${applicationId}/users/${userId}/identities/${externalUserId}/profile`), false);
        assert.equal(isNoAuthorizationRoute("GET", `/applications/${applicationId}/users/${userId}/identities/${externalUserId}/profile`), false);

        const response = await requestJson(createAuthenticatedApp(), `/applications/${applicationId}/users/${userId}/identities/${externalUserId}/profile`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("requires an OAuth2 application token for the path application", async () => {
        assert.equal(getOAuthApplicationProfileApplicationId({ client_id: applicationId }), applicationId);
        assert.equal(getOAuthApplicationProfileApplicationId({ application: { id: applicationId } }), applicationId);
        assert.equal(getOAuthApplicationProfileApplicationId({ azp: applicationId }), applicationId);

        assert.throws(() => assertOAuthApplicationProfileToken({ sub: "user-token" }, applicationId), DiscordApiErrors.INVALID_OAUTH_TOKEN);
        assert.throws(() => assertOAuthApplicationProfileToken({ client_id: "other-application" }, applicationId), DiscordApiErrors.INVALID_OAUTH_TOKEN);

        const userToken = await requestJson(
            createRouteApp({ token: { sub: "user-token" } }),
            `/applications/${applicationId}/users/${userId}/identities/${externalUserId}/profile`,
        );
        assert.equal(userToken.status, 400);
        assert.equal((userToken.body as { code?: number }).code, DiscordApiErrors.INVALID_OAUTH_TOKEN.code);

        const wrongApplication = await requestJson(
            createRouteApp({ token: { client_id: "other-application" } }),
            `/applications/${applicationId}/users/${userId}/identities/${externalUserId}/profile`,
        );
        assert.equal(wrongApplication.status, 400);
        assert.equal((wrongApplication.body as { code?: number }).code, DiscordApiErrors.INVALID_OAUTH_TOKEN.code);
    });

    test("returns a locally backed user application profile when a provider supplies one", async () => {
        let providerApplicationId: string | undefined;
        let providerUserId: string | undefined;
        let providerExternalUserId: string | undefined;
        const profile: UserApplicationProfileResponse = {
            username: "external-name",
            metadata: "",
            data: {
                primary: {
                    season: "Season 5.0",
                    rank_name: "No Season Data",
                    playtime_hours: 2.29,
                },
            },
            data_trusted: true,
            external_id: {
                provider_type: "UNITY",
                provider_issued_user_id: externalUserId,
                provider_id: "identity-provider-client",
                preferred_global_name: null,
            },
            avatar_hash: null,
        };
        const provider: UserApplicationProfileProvider = (currentApplicationId, currentUserId, currentExternalUserId) => {
            providerApplicationId = currentApplicationId;
            providerUserId = currentUserId;
            providerExternalUserId = currentExternalUserId;
            return profile;
        };

        const response = await requestJson(createRouteApp({ provider }), `/applications/${applicationId}/users/${userId}/identities/${externalUserId}/profile`);

        assert.equal(response.status, 200);
        assert.equal(providerApplicationId, applicationId);
        assert.equal(providerUserId, userId);
        assert.equal(providerExternalUserId, externalUserId);
        assert.deepEqual(response.body, profile);
    });

    test("fails closed instead of fabricating an unsupported external profile", async () => {
        assert.equal(getLocalUserApplicationProfile(applicationId, userId, externalUserId), undefined);

        const response = await requestJson(createRouteApp(), `/applications/${applicationId}/users/${userId}/identities/${externalUserId}/profile`);

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: 404,
            message: "Error: Unknown user application profile",
        });
    });

    test("declares source-backed metadata and generated artifacts for the exact owned GET path", () => {
        const routeSource = readFileSync(
            join(process.cwd(), "src", "api", "routes", "applications", "#application_id", "users", "#user_id", "identities", "#external_user_id", "profile.ts"),
            "utf8",
        );
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            components?: {
                schemas?: Record<string, JsonSchema>;
            };
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    patch?: unknown;
                }
            >;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                path?: string;
                sourceFile?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            route?: string;
            route_name?: string;
            source?: string;
            response_schema_refs?: string[];
        }[];
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        };
        const contractTests = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                manifestId?: string;
                authMode?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const suiteCoverage = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "suite-coverage.json"), "utf8")) as unknown;

        assert.match(routeSource, /summary:\s*"Get User Application Profile"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"UserApplicationProfileResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.UserApplicationProfileResponse.type, "object");
        assert.deepEqual(schemas.UserApplicationProfileResponse.required?.sort(), ["avatar_hash", "external_id", "metadata", "username"]);
        assert.equal(schemas.UserApplicationProfileResponse.properties?.external_id?.$ref, "#/definitions/UserApplicationProfileExternalIdResponse");
        assert.deepEqual(schemas.UserApplicationProfileExternalIdResponse.required?.sort(), ["provider_issued_user_id", "provider_type"]);
        assert.deepEqual(schemas.UserApplicationProfileResponse.properties?.avatar_hash?.type, ["null", "string"]);
        assert.equal(openapi.components?.schemas?.UserApplicationProfileResponse?.properties?.external_id?.$ref, "#/components/schemas/UserApplicationProfileExternalIdResponse");

        const route = openapi.paths?.["/applications/{application_id}/users/{user_id}/identities/{external_user_id}/profile/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UserApplicationProfileResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/applications/{application_id}/users/{user_id}/identities/{external_user_id}/profile/"]?.patch, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/applications/:application_id/users/:user_id/identities/:external_user_id/profile/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/applications/#application_id/users/#user_id/identities/#external_user_id/profile.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("UserApplicationProfileResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedPath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/applications/#application_id/users/#user_id/identities/#external_user_id/profile.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "UserApplicationProfileResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedMissingPath && entry.route_name === assignedRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PATCH" && entry.route === assignedMissingPath),
            true,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "UserApplicationProfileResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401, 404]);
        assert.equal(JSON.stringify(suiteCoverage).includes(coveredManifestIds[0]), true);
    });
});

type CreateRouteAppOptions = {
    provider?: UserApplicationProfileProvider;
    token?: Record<string, unknown>;
};

function createRouteApp(options: CreateRouteAppOptions = {}) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "requester";
        req.token = (options.token ?? { client_id: applicationId }) as never;
        next();
    });
    app.use("/applications/:application_id/users/:user_id/identities/:external_user_id/profile", createUserApplicationProfileRouter(options.provider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/applications/:application_id/users/:user_id/identities/:external_user_id/profile", createUserApplicationProfileRouter());
    app.use(ErrorHandler);

    return app;
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
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
