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
import { afterEach, describe, test, type TestContext } from "node:test";
import type { ConnectionSyncExternalFriendListEntriesPutSchema } from "@spacebar/schemas";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../../../../../middlewares";
import type { ContactSyncExternalFriendListEntriesDependencies } from "./external-friend-list-entries";

const requireModule = require;
const routeModulePath = require.resolve("./external-friend-list-entries");
const routePath = "/users/@me/connections/contacts/@me/external-friend-list-entries";
const manifestId = "api:http:PUT:/users/@me/connections/contacts/@me/external-friend-list-entries/";
const sourceFile = "src/api/routes/users/@me/connections/contacts/@me/external-friend-list-entries.ts";

const validContactSyncBody: ConnectionSyncExternalFriendListEntriesPutSchema = {
    friend_list_entries: [
        {
            friend_id: "+15555550123",
        },
    ],
    background: false,
    allowed_in_suggestions: 2,
    include_mutual_friends_count: true,
    add_reverse_friend_suggestions: true,
};

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("PUT /users/@me/connections/contacts/@me/external-friend-list-entries", () => {
    test("declares authenticated contact sync metadata", (t) => {
        const routeOptions = captureRouteOptions(t);

        assert.deepEqual(routeOptions[0], {
            summary: "Update Contact Sync External Friend List Entries",
            description:
                "Syncs device contacts for the current user's contact-sync connection when a real contact matching backend is configured. The default Spacebar instance has no durable contact-sync friend-list state or provider-backed suggestion model, so it fails closed with 501 instead of fabricating matches, friend suggestions, or bulk-add tokens.",
            requestBody: "ConnectionSyncExternalFriendListEntriesPutSchema",
            coerceRequestBody: false,
            responses: {
                200: {
                    body: "ConnectionSyncExternalFriendListEntriesResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(express.json());
        app.use(Authentication);
        app.use(routePath, loadRouteModule().default);
        app.use(ErrorHandler);

        assert.equal(isNoAuthorizationRoute("PUT", routePath), false);
        assert.equal(isNoAuthorizationRoute("PUT", `/api/v9${routePath}`), false);

        const response = await requestJson(app, routePath, {
            method: "PUT",
            body: validContactSyncBody,
        });

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("rejects schema-invalid contact sync payloads before calling the backend", async () => {
        const calls: unknown[] = [];
        const dependencies: ContactSyncExternalFriendListEntriesDependencies = {
            async syncExternalFriendListEntries(userId, body) {
                calls.push({ userId, body });
                return {
                    bulk_add_token: null,
                    friend_suggestions: [],
                };
            },
        };
        const app = createAuthenticatedRouteApp(loadRouteModule().createContactSyncExternalFriendListEntriesRouter(dependencies));

        const response = await requestJson(app, routePath, {
            method: "PUT",
            body: {
                ...validContactSyncBody,
                friend_list_entries: [{ friend_id: "not-e164" }],
            },
        });

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, 50035);
        assert.equal((response.body as { message?: unknown }).message, "Invalid Form Body");
        assert.deepEqual(calls, []);
    });

    test("fails closed by default instead of fabricating contact matches", async () => {
        const routeModule = loadRouteModule();
        const unsupportedError = routeModule.createContactSyncExternalFriendListEntriesUnsupportedError();
        const app = createAuthenticatedRouteApp(routeModule.default);

        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, routeModule.CONTACT_SYNC_EXTERNAL_FRIEND_LIST_ENTRIES_UNSUPPORTED_MESSAGE);

        const response = await requestJson(app, routePath, {
            method: "PUT",
            body: validContactSyncBody,
        });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: routeModule.CONTACT_SYNC_EXTERNAL_FRIEND_LIST_ENTRIES_UNSUPPORTED_MESSAGE,
        });
    });

    test("delegates valid contact sync payloads to a configured backend", async () => {
        const calls: unknown[] = [];
        const dependencies: ContactSyncExternalFriendListEntriesDependencies = {
            async syncExternalFriendListEntries(userId, body) {
                calls.push({ userId, body: JSON.parse(JSON.stringify(body)) });
                return {
                    bulk_add_token: "bulk-add-token",
                    friend_suggestions: [],
                };
            },
        };
        const app = createAuthenticatedRouteApp(loadRouteModule().createContactSyncExternalFriendListEntriesRouter(dependencies));

        const response = await requestJson(app, routePath, {
            method: "PUT",
            body: validContactSyncBody,
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            bulk_add_token: "bulk-add-token",
            friend_suggestions: [],
        });
        assert.deepEqual(calls, [
            {
                userId: "authorized-user",
                body: validContactSyncBody,
            },
        ]);
    });

    test("generated artifacts own only the assigned concrete PUT contact sync route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), sourceFile), "utf8");
        const schemas = readJson<
            Record<
                string,
                {
                    enum?: number[];
                    properties?: Record<string, { type?: string | string[]; pattern?: string; maxItems?: number; items?: { $ref?: string }; $ref?: string; enum?: number[] }>;
                    required?: string[];
                    type?: string;
                }
            >
        >(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    put?: {
                        requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    get?: unknown;
                    post?: unknown;
                    patch?: unknown;
                    delete?: unknown;
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
                path?: string;
                sourceFile?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                    hasQuery?: boolean;
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
        const suiteCoverage = readJson<{ groups?: { suites?: { testFiles?: string[]; manifestIds?: string[] }[] }[] }>(path.join("test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /router\.put\(\s*["']\/["']/);
        assert.match(routeSource, /requestBody:\s*"ConnectionSyncExternalFriendListEntriesPutSchema"/);
        assert.match(routeSource, /coerceRequestBody:\s*false/);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(get|post|patch|delete|options)\(/);

        assert.equal(schemas.ConnectionSyncExternalFriendListEntry?.properties?.friend_id?.pattern, "^\\+[1-9]\\d{1,14}$");
        assert.equal(schemas.ConnectionSyncExternalFriendListEntriesPutSchema?.properties?.friend_list_entries?.maxItems, 10000);
        assert.deepEqual(schemas.ConnectionSyncExternalFriendListEntriesPutSchema?.properties?.friend_list_entries?.items, {
            $ref: "#/definitions/ConnectionSyncExternalFriendListEntry",
        });
        assert.deepEqual(schemas.ConnectionSyncExternalFriendListEntriesPutSchema?.properties?.allowed_in_suggestions, {
            $ref: "#/definitions/ConnectionSyncSuggestionsSetting",
        });
        assert.deepEqual(schemas.ConnectionSyncSuggestionsSetting?.enum, [1, 2]);
        assert.deepEqual(schemas.ConnectionSyncExternalFriendListEntriesPutSchema?.required?.sort(), [
            "allowed_in_suggestions",
            "background",
            "friend_list_entries",
            "include_mutual_friends_count",
        ]);
        assert.deepEqual([...((schemas.ConnectionSyncExternalFriendListEntriesResponse?.properties?.bulk_add_token?.type as string[] | undefined) ?? [])].sort(), [
            "null",
            "string",
        ]);
        assert.deepEqual(schemas.ConnectionSyncExternalFriendListEntriesResponse?.properties?.friend_suggestions?.items, {
            $ref: "#/definitions/FriendSuggestion",
        });

        const openapiRoute = openapi.paths?.["/users/@me/connections/contacts/@me/external-friend-list-entries/"]?.put;
        assert.equal(openapiRoute?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ConnectionSyncExternalFriendListEntriesPutSchema");
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ConnectionSyncExternalFriendListEntriesResponse");
        assert.equal(openapiRoute?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/users/@me/connections/contacts/@me/external-friend-list-entries/"]?.get, undefined);
        assert.equal(openapi.paths?.["/users/@me/connections/contacts/@me/external-friend-list-entries/"]?.post, undefined);
        assert.equal(openapi.paths?.["/users/@me/connections/contacts/@me/external-friend-list-entries/"]?.patch, undefined);
        assert.equal(openapi.paths?.["/users/@me/connections/contacts/@me/external-friend-list-entries/"]?.delete, undefined);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "PUT" && entry.route === routePath);
        assert.equal(sourceRoute?.route_name, "PUT_USERS__ME_CONNECTIONS_CONTACTS__ME_EXTERNAL_FRIEND_LIST_ENTRIES");
        assert.equal(sourceRoute?.source, sourceFile);
        assert.equal(sourceRoute?.request_schema_ref, "ConnectionSyncExternalFriendListEntriesPutSchema");
        assert.deepEqual(sourceRoute?.response_schema_refs, ["APIErrorResponse", "ConnectionSyncExternalFriendListEntriesResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PUT" && entry.route === routePath && entry.route_name === "CONNECTION_SYNC_CONTACTS"),
            false,
        );
        assert.equal(missingRoutes.routes?.includes(routePath), false);
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PUT" && entry.route === "/users/@me/connections/contacts/{param}"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PUT" && entry.route === "/users/@me/connections/contacts/{param}/external-friend-list-entries"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "GET" && entry.route === "/users/@me/connections/contacts/{param}/external-friend-list-entries/settings",
            ),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.path, `${routePath}/`);
        assert.equal(manifestEntry?.sourceFile, sourceFile);
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "ConnectionSyncExternalFriendListEntriesPutSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "ConnectionSyncExternalFriendListEntriesResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 400, 401, 501]);
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, false);

        const contractEntry = contractMatrix.contracts?.find((contract) => contract.manifestId === manifestId);
        assert.equal(contractEntry?.sourceFile, sourceFile);
        assert.equal(contractEntry?.routeMetadata?.requestBody, "ConnectionSyncExternalFriendListEntriesPutSchema");
        assert.deepEqual(contractEntry?.routeMetadata?.responses, ["APIErrorResponse", "ConnectionSyncExternalFriendListEntriesResponse"]);
        assert.deepEqual(contractEntry?.routeMetadata?.responseStatuses, [200, 400, 401, 501]);
        assert.equal(
            suiteCoverage.groups?.some((group) => group.suites?.some((suite) => suite.manifestIds?.includes(manifestId))),
            true,
        );
    });
});

function loadRouteModule(): typeof import("./external-friend-list-entries") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./external-friend-list-entries");
}

function captureRouteOptions(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    loadRouteModule();

    return routeOptions;
}

function createAuthenticatedRouteApp(router: express.Router) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "authorized-user";
        next();
    });
    app.use(routePath, router);
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, requestPath: string, options: { method?: string; body?: unknown } = {}): Promise<{ status: number; body: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: options.method,
            headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
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

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), filePath), "utf8")) as T;
}
