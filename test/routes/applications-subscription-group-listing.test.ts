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
import { describe, test, type TestContext } from "node:test";
import { isNoAuthorizationRoute } from "@spacebar/api";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import {
    createApplicationSubscriptionGroupListingRouter,
    deleteApplicationSubscriptionGroupListing,
    deleteConfiguredApplicationSubscriptionGroupListing,
    getApplicationSubscriptionGroupListing,
    getConfiguredApplicationSubscriptionGroupListing,
    UNKNOWN_APPLICATION_SUBSCRIPTION_GROUP_LISTING_ERROR,
    type ApplicationSubscriptionGroupListingRouteDependencies,
} from "../../src/api/routes/applications/#application_id/subscription-group-listings/#subscription_group_listing_id";

const applicationId = "100000000000000001";
const listingId = "100000000000000002";
const otherListingId = "100000000000000003";
const getManifestId = "api:http:GET:/applications/:application_id/subscription-group-listings/:subscription_group_listing_id/";
const deleteManifestId = "api:http:DELETE:/applications/:application_id/subscription-group-listings/:subscription_group_listing_id/";
const assignedRoute = "/applications/{param}/subscription-group-listings/{param}";
const sourceRoute = "/applications/{application_id}/subscription-group-listings/{subscription_group_listing_id}";
const sourceFile = "src/api/routes/applications/#application_id/subscription-group-listings/#subscription_group_listing_id.ts";

type JsonSchema = {
    $ref?: string;
    additionalProperties?: unknown;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

type OpenApiDocument = {
    paths?: Record<
        string,
        {
            get?: {
                summary?: string;
                description?: string;
                responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                security?: unknown;
            };
            delete?: {
                summary?: string;
                description?: string;
                responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                security?: unknown;
            };
        }
    >;
};

type SourceRouteCatalogEntry = {
    method?: string;
    response_schema_refs?: string[];
    route?: string;
    route_name?: string;
    source?: string;
};

type MissingRoutesReport = {
    missing_entries: Array<{ method?: string; route?: string; route_name?: string }>;
};

type TestingManifest = {
    entries?: Array<{
        id?: string;
        authMode?: string;
        sourceFile?: string;
        routeMetadata?: {
            present?: boolean;
            responseBodies?: string[];
            responseStatuses?: number[];
        };
    }>;
};

type HttpContracts = {
    contracts?: Array<{ manifestId?: string }>;
};

type SuiteCoverage = {
    groups?: Array<{ suites?: Array<{ id?: string; manifestIds?: string[] }> }>;
};

function createApplicationRepository(t: TestContext, ownerId = "owner") {
    return {
        findOne: t.mock.fn(async (_options: unknown) => ({
            owner: {
                id: ownerId,
            },
        })),
    };
}

function createRouteApp(userId: string, dependencies: ApplicationSubscriptionGroupListingRouteDependencies = {}) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/applications/:application_id/subscription-group-listings/:subscription_group_listing_id", createApplicationSubscriptionGroupListingRouter(dependencies));
    app.use((error: { code?: number; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 500).json({
            code: error.code,
            message: error.message,
        });
    });

    return app;
}

async function requestJson(app: express.Express, requestPath: string, init: { method?: string } = {}) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");

    try {
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${requestPath}`, init);
        const text = await response.text();
        return {
            status: response.status,
            body: text ? (JSON.parse(text) as unknown) : undefined,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(join(process.cwd(), file), "utf8")) as T;
}

describe("GET /applications/:application_id/subscription-group-listings/:subscription_group_listing_id", () => {
    test("stays scoped to the authenticated application subscription group listing route", () => {
        assert.equal(isNoAuthorizationRoute("GET", `/applications/${applicationId}/subscription-group-listings/${listingId}`), false);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v10/applications/${applicationId}/subscription-group-listings/${listingId}`), false);
        assert.equal(isNoAuthorizationRoute("DELETE", `/applications/${applicationId}/subscription-group-listings/${listingId}`), false);
    });

    test("returns provider-backed listing data for users with application store access", async (t) => {
        const applicationRepository = createApplicationRepository(t);
        const listing = {
            id: listingId,
            application_id: applicationId,
            name: "Premium subscription group",
            subscription_plans: [{ id: "100000000000000004", interval: 1 }],
        };
        const listingProvider = t.mock.fn(async (_options: unknown) => listing);

        const result = await getApplicationSubscriptionGroupListing(applicationId, listingId, "owner", {
            applicationRepository,
            listingProvider,
        });

        assert.deepEqual(result, listing);
        assert.notEqual(result, listing);
        assert.deepEqual(applicationRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: applicationId },
            relations: {
                owner: true,
                bot: true,
                team: {
                    members: true,
                },
            },
        });
        assert.deepEqual(listingProvider.mock.calls[0].arguments[0], {
            application_id: applicationId,
            subscription_group_listing_id: listingId,
        });

        const response = await requestJson(
            createRouteApp("owner", { applicationRepository, listingProvider }),
            `/applications/${applicationId}/subscription-group-listings/${listingId}`,
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, listing);
    });

    test("fails closed with a not-found store listing error when no local provider data exists", async (t) => {
        const applicationRepository = createApplicationRepository(t);
        const listingProvider = t.mock.fn(getConfiguredApplicationSubscriptionGroupListing);

        const response = await requestJson(
            createRouteApp("owner", { applicationRepository, listingProvider }),
            `/applications/${applicationId}/subscription-group-listings/${listingId}`,
        );

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_STORE_LISTING.code,
            message: DiscordApiErrors.UNKNOWN_STORE_LISTING.message,
        });
        assert.equal(UNKNOWN_APPLICATION_SUBSCRIPTION_GROUP_LISTING_ERROR.httpStatus, 404);
        assert.equal(listingProvider.mock.callCount(), 1);
    });

    test("deletes provider-backed listing data for users with application store access", async (t) => {
        const applicationRepository = createApplicationRepository(t);
        const listingDeleter = t.mock.fn(async (_options: unknown) => true);

        const result = await deleteApplicationSubscriptionGroupListing(applicationId, listingId, "owner", {
            applicationRepository,
            listingDeleter,
        });

        assert.equal(result, true);
        assert.deepEqual(applicationRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: applicationId },
            relations: {
                owner: true,
                bot: true,
                team: {
                    members: true,
                },
            },
        });
        assert.deepEqual(listingDeleter.mock.calls[0].arguments[0], {
            application_id: applicationId,
            subscription_group_listing_id: listingId,
        });

        const response = await requestJson(
            createRouteApp("owner", { applicationRepository, listingDeleter }),
            `/applications/${applicationId}/subscription-group-listings/${listingId}`,
            { method: "DELETE" },
        );

        assert.equal(response.status, 204);
        assert.equal(response.body, undefined);
        assert.equal(listingDeleter.mock.callCount(), 2);
    });

    test("fails closed with a not-found store listing error when no local deleter exists", async (t) => {
        const applicationRepository = createApplicationRepository(t);
        const listingDeleter = t.mock.fn(deleteConfiguredApplicationSubscriptionGroupListing);

        assert.equal(
            await deleteApplicationSubscriptionGroupListing(applicationId, listingId, "owner", {
                applicationRepository,
                listingDeleter,
            }),
            false,
        );

        const response = await requestJson(
            createRouteApp("owner", { applicationRepository, listingDeleter }),
            `/applications/${applicationId}/subscription-group-listings/${listingId}`,
            { method: "DELETE" },
        );

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_STORE_LISTING.code,
            message: DiscordApiErrors.UNKNOWN_STORE_LISTING.message,
        });
        assert.equal(listingDeleter.mock.callCount(), 2);
    });

    test("returns 403 before consulting subscription group listing data for unauthorized application users", async (t) => {
        const applicationRepository = createApplicationRepository(t);
        const listingProvider = t.mock.fn(async (_options: unknown) => ({
            id: listingId,
            application_id: applicationId,
        }));
        const listingDeleter = t.mock.fn(async (_options: unknown) => true);

        const response = await requestJson(
            createRouteApp("viewer", { applicationRepository, listingProvider }),
            `/applications/${applicationId}/subscription-group-listings/${listingId}`,
        );

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
        assert.equal(listingProvider.mock.callCount(), 0);

        const deleteResponse = await requestJson(
            createRouteApp("viewer", { applicationRepository, listingDeleter }),
            `/applications/${applicationId}/subscription-group-listings/${listingId}`,
            { method: "DELETE" },
        );

        assert.equal(deleteResponse.status, 403);
        assert.deepEqual(deleteResponse.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
        assert.equal(listingDeleter.mock.callCount(), 0);
    });

    test("rejects malformed or mismatched route identifiers without returning unrelated listings", async (t) => {
        const applicationRepository = createApplicationRepository(t);
        const listingProvider = t.mock.fn(async (_options: unknown) => ({
            id: otherListingId,
            application_id: applicationId,
        }));
        const listingDeleter = t.mock.fn(async (options: { subscription_group_listing_id: string }) => options.subscription_group_listing_id === listingId);

        await assert.rejects(
            () => getApplicationSubscriptionGroupListing("not-a-snowflake", listingId, "owner", { applicationRepository, listingProvider }),
            (error: { code?: unknown }) => error.code === DiscordApiErrors.UNKNOWN_APPLICATION.code,
        );
        await assert.rejects(
            () => getApplicationSubscriptionGroupListing(applicationId, "not-a-snowflake", "owner", { applicationRepository, listingProvider }),
            (error: { code?: unknown }) => error.code === DiscordApiErrors.UNKNOWN_STORE_LISTING.code,
        );
        await assert.rejects(
            () => getApplicationSubscriptionGroupListing(applicationId, listingId, "owner", { applicationRepository, listingProvider }),
            (error: { code?: unknown }) => error.code === DiscordApiErrors.UNKNOWN_STORE_LISTING.code,
        );
        await assert.rejects(
            () => deleteApplicationSubscriptionGroupListing("not-a-snowflake", listingId, "owner", { applicationRepository, listingDeleter }),
            (error: { code?: unknown }) => error.code === DiscordApiErrors.UNKNOWN_APPLICATION.code,
        );
        await assert.rejects(
            () => deleteApplicationSubscriptionGroupListing(applicationId, "not-a-snowflake", "owner", { applicationRepository, listingDeleter }),
            (error: { code?: unknown }) => error.code === DiscordApiErrors.UNKNOWN_STORE_LISTING.code,
        );

        assert.equal(
            await deleteApplicationSubscriptionGroupListing(applicationId, otherListingId, "owner", {
                applicationRepository,
                listingDeleter,
            }),
            false,
        );
        assert.deepEqual(listingDeleter.mock.calls[0].arguments[0], {
            application_id: applicationId,
            subscription_group_listing_id: otherListingId,
        });
    });

    test("generated artifacts cover the assigned route methods and leave adjacent routes untouched", () => {
        const routeSource = readFileSync(join(process.cwd(), sourceFile), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(join("assets", "schemas.json"));
        const openapi = readJson<OpenApiDocument>(join("assets", "openapi.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join("packages", "missing-routes", "missing.json"));
        const manifest = readJson<TestingManifest>(join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<HttpContracts>(join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<SuiteCoverage>(join("test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /router\.get\(\s*["']\/["']/);
        assert.match(routeSource, /router\.delete\(\s*["']\/["']/);
        assert.doesNotMatch(routeSource, /router\.(?:post|put|patch)\(/);
        assert.doesNotMatch(routeSource, /role-subscriptions|subscription-listings|trial|trials|products|purchase|payout|entitlement|billing|sku/i);

        assert.equal(schemas.ApplicationSubscriptionGroupListingResponse?.type, "object");
        assert.deepEqual(schemas.ApplicationSubscriptionGroupListingResponse?.additionalProperties, {});

        const path = openapi.paths?.["/applications/{application_id}/subscription-group-listings/{subscription_group_listing_id}/"];
        const getRoute = path?.get;
        assert.equal(getRoute?.summary, "Get Application Subscription Group Listing");
        assert.equal(getRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationSubscriptionGroupListingResponse");
        assert.equal(getRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(getRoute?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(getRoute?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(getRoute?.security, [{ bearer: [] }]);

        const deleteRoute = path?.delete;
        assert.equal(deleteRoute?.summary, "Delete Application Subscription Group Listing");
        assert.equal(deleteRoute?.responses?.["204"]?.content, undefined);
        assert.equal(deleteRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(deleteRoute?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(deleteRoute?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(deleteRoute?.security, [{ bearer: [] }]);

        const getSourceRoute = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === sourceRoute);
        assert.equal(getSourceRoute?.route_name, "GET_APPLICATIONS_APPLICATION_ID_SUBSCRIPTION_GROUP_LISTINGS_SUBSCRIPTION_GROUP_LISTING_ID");
        assert.equal(getSourceRoute?.source, sourceFile);
        assert.equal(getSourceRoute?.response_schema_refs?.includes("ApplicationSubscriptionGroupListingResponse"), true);
        assert.equal(getSourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);

        const deleteSourceRoute = sourceCatalog.find((entry) => entry.method === "DELETE" && entry.route === sourceRoute);
        assert.equal(deleteSourceRoute?.route_name, "DELETE_APPLICATIONS_APPLICATION_ID_SUBSCRIPTION_GROUP_LISTINGS_SUBSCRIPTION_GROUP_LISTING_ID");
        assert.equal(deleteSourceRoute?.source, sourceFile);
        assert.equal(deleteSourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);
        assert.equal(deleteSourceRoute?.response_schema_refs?.includes("ApplicationSubscriptionGroupListingResponse"), false);

        for (const method of ["GET", "DELETE"]) {
            assert.equal(
                missingRoutes.missing_entries.some(
                    (entry) => entry.method === method && entry.route === assignedRoute && entry.route_name === "APPLICATION_SUBSCRIPTION_GROUP_LISTING",
                ),
                false,
            );
        }

        const getManifestEntry = manifest.entries?.find((entry) => entry.id === getManifestId);
        assert.equal(getManifestEntry?.authMode, "bearer");
        assert.equal(getManifestEntry?.sourceFile, sourceFile);
        assert.equal(getManifestEntry?.routeMetadata?.present, true);
        assert.equal(getManifestEntry?.routeMetadata?.responseBodies?.includes("ApplicationSubscriptionGroupListingResponse"), true);
        assert.equal(getManifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(getManifestEntry?.routeMetadata?.responseStatuses, [200, 401, 403, 404]);

        const deleteManifestEntry = manifest.entries?.find((entry) => entry.id === deleteManifestId);
        assert.equal(deleteManifestEntry?.authMode, "bearer");
        assert.equal(deleteManifestEntry?.sourceFile, sourceFile);
        assert.equal(deleteManifestEntry?.routeMetadata?.present, true);
        assert.deepEqual(deleteManifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(deleteManifestEntry?.routeMetadata?.responseStatuses, [204, 401, 403, 404]);

        for (const id of [getManifestId, deleteManifestId]) {
            assert.equal(
                contractMatrix.contracts?.some((contract) => contract.manifestId === id),
                true,
            );
        }
        const applicationsSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "applications-commands");
        assert.equal(applicationsSuite?.manifestIds?.includes(getManifestId), true);
        assert.equal(applicationsSuite?.manifestIds?.includes(deleteManifestId), true);
    });
});
