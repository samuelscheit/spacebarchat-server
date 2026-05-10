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
import { describe, test } from "node:test";
import express from "express";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import { isNoAuthorizationRoute } from "../../src/api/middlewares/NoAuthorizationRoutes";
import {
    createApplicationRpcRouter,
    getApplicationRpcResponse,
    toApplicationRpcResponse,
    type ApplicationRpcRepositories,
} from "../../src/api/routes/applications/#application_id/rpc";
import { DiscordApiErrors } from "../../src/util";

const coveredManifestIds = ["api:http:GET:/applications/:application_id/rpc/"];

type JsonSchema = {
    anyOf?: JsonSchema[];
    enum?: unknown[];
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
    $ref?: string;
};

function makeApplication(overrides: Record<string, unknown> = {}) {
    return {
        id: "880218394199220334",
        name: "Watch Together",
        description: "Create and watch shared playlists of YouTube videos with your friends.",
        icon: "ec48acbad4c32efab4275cb9f3ca3a58",
        summary: "",
        type: null,
        cover_image: "3cc9446876ae9eec6e06ff565703c292",
        hook: true,
        bot_public: true,
        bot_require_code_grant: false,
        terms_of_service_url: "https://discord.com/terms",
        privacy_policy_url: "https://discord.com/privacy",
        install_params: { scopes: ["applications.commands"], permissions: "0" },
        verify_key: "e2aaf50fbe2fd9d025ac669035f5efb89099931690fba9dc28efb7eaade7f96d",
        flags: 9568258,
        tags: ["Video Player", "Watch"],
        owner: { id: "owner" },
        team: { id: "team" },
        redirect_uris: ["https://private.example/callback"],
        interactions_endpoint_url: "https://private.example/interactions",
        custom_install_url: "https://private.example/install",
        integration_public: true,
        integration_require_code_grant: false,
        ...overrides,
    };
}

function createApp(repositories: ApplicationRpcRepositories) {
    const app = express();
    app.use(express.json());
    app.use("/applications/:application_id/rpc", createApplicationRpcRouter(repositories));
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${requestPath}`);
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

function propertyTypes(schema: JsonSchema) {
    if (Array.isArray(schema.type)) return schema.type.toSorted();
    if (typeof schema.type === "string") return [schema.type];
    return [];
}

function isDiscordError(error: unknown, expected: typeof DiscordApiErrors.UNKNOWN_APPLICATION) {
    return (error as { code?: unknown; message?: unknown })?.code === expected.code && (error as { code?: unknown; message?: unknown })?.message === expected.message;
}

describe("GET /applications/:application_id/rpc", () => {
    test("serializes the source-backed unauthenticated RPC application projection", () => {
        const response = toApplicationRpcResponse(makeApplication() as never) as unknown as Record<string, unknown>;

        assert.deepEqual(response, {
            id: "880218394199220334",
            name: "Watch Together",
            description: "Create and watch shared playlists of YouTube videos with your friends.",
            icon: "ec48acbad4c32efab4275cb9f3ca3a58",
            summary: "",
            type: null,
            cover_image: "3cc9446876ae9eec6e06ff565703c292",
            hook: true,
            bot_public: true,
            bot_require_code_grant: false,
            terms_of_service_url: "https://discord.com/terms",
            privacy_policy_url: "https://discord.com/privacy",
            install_params: { scopes: ["applications.commands"], permissions: "0" },
            verify_key: "e2aaf50fbe2fd9d025ac669035f5efb89099931690fba9dc28efb7eaade7f96d",
            flags: 9568258,
            tags: ["Video Player", "Watch"],
        });
        assert.equal("owner" in response, false);
        assert.equal("team" in response, false);
        assert.equal("redirect_uris" in response, false);
        assert.equal("interactions_endpoint_url" in response, false);
        assert.equal("custom_install_url" in response, false);
        assert.equal("integration_public" in response, false);
    });

    test("omits optional RPC fields that Spacebar cannot back for an application", () => {
        const response = toApplicationRpcResponse(
            makeApplication({
                summary: null,
                cover_image: null,
                terms_of_service_url: null,
                privacy_policy_url: null,
                install_params: null,
                tags: undefined,
            }) as never,
        ) as unknown as Record<string, unknown>;

        assert.equal("summary" in response, false);
        assert.equal("cover_image" in response, false);
        assert.equal("terms_of_service_url" in response, false);
        assert.equal("privacy_policy_url" in response, false);
        assert.equal("install_params" in response, false);
        assert.equal("tags" in response, false);
    });

    test("loads only the fields used by the unauthenticated RPC projection", async (t) => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/applications/:application_id/rpc/"]);
        const calls: unknown[] = [];
        const applicationRepository = {
            findOne: t.mock.fn(async (options: unknown) => {
                calls.push(options);
                return makeApplication() as never;
            }),
        };

        const response = await getApplicationRpcResponse("880218394199220334", { applicationRepository });

        assert.equal(response.id, "880218394199220334");
        assert.deepEqual(calls[0], {
            where: { id: "880218394199220334" },
            select: {
                id: true,
                name: true,
                description: true,
                icon: true,
                summary: true,
                type: true,
                cover_image: true,
                hook: true,
                bot_public: true,
                bot_require_code_grant: true,
                terms_of_service_url: true,
                privacy_policy_url: true,
                install_params: true,
                verify_key: true,
                flags: true,
                tags: true,
            },
        });
    });

    test("throws unknown application for missing application IDs", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        await assert.rejects(
            () => getApplicationRpcResponse("100000000000000009", { applicationRepository }),
            (error) => isDiscordError(error, DiscordApiErrors.UNKNOWN_APPLICATION),
        );
    });

    test("returns the mounted route response", async () => {
        const app = createApp({
            applicationRepository: {
                findOne: async () => makeApplication() as never,
            },
        });

        const response = await requestJson(app, "/applications/880218394199220334/rpc");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, toApplicationRpcResponse(makeApplication() as never));
    });

    test("returns the mounted route unknown application response", async () => {
        const app = createApp({
            applicationRepository: {
                findOne: async () => null,
            },
        });

        const response = await requestJson(app, "/applications/100000000000000009/rpc");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
    });

    test("classifies only the assigned RPC application route as unauthenticated", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/applications/880218394199220334/rpc"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/applications/880218394199220334/rpc/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/applications/880218394199220334/rpc"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/applications/880218394199220334/public"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/oauth2/applications/880218394199220334/rpc"), false);
    });

    test("documents unauthenticated route metadata", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "applications", "#application_id", "rpc.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get RPC Application"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ApplicationRpcResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /401:\s*\{/);
    });

    test("generates source catalog, OpenAPI, testing manifest, contract, and schema metadata", () => {
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            response_schema_refs?: string[];
            route?: string;
            route_name?: string;
            source?: string;
        }[];
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            components?: { schemas?: Record<string, JsonSchema> };
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        };
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                authMode?: string;
                id?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const contracts = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/applications/{application_id}/rpc");
        assert.equal(sourceEntry?.route_name, "GET_APPLICATIONS_APPLICATION_ID_RPC");
        assert.equal(sourceEntry?.source, "src/api/routes/applications/#application_id/rpc.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ApplicationRpcResponse"]);

        const route = openapi.paths?.["/applications/{application_id}/rpc/"]?.get;
        assert.equal(route?.security, undefined);
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationRpcResponse");
        assert.equal(route?.responses?.["401"], undefined);
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");

        const responseSchema = schemas.ApplicationRpcResponse;
        assert.deepEqual(propertyTypes(responseSchema.properties?.id ?? {}), ["string"]);
        assert.deepEqual(propertyTypes(responseSchema.properties?.hook ?? {}), ["boolean"]);
        assert.deepEqual(propertyTypes(responseSchema.properties?.flags ?? {}), ["integer"]);
        assert.deepEqual(propertyTypes(responseSchema.properties?.icon ?? {}), ["null", "string"]);
        assert.equal(responseSchema.required?.includes("verify_key"), true);
        assert.equal(responseSchema.required?.includes("summary"), false);
        assert.deepEqual(openapi.components?.schemas?.ApplicationRpcResponse?.required, responseSchema.required);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "public");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "ApplicationRpcResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 404]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "public");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "ApplicationRpcResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 404]);
    });
});
