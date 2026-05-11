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
import express from "express";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import { isNoAuthorizationRoute } from "../../src/api/middlewares/NoAuthorizationRoutes";
import { createOAuth2ApplicationRpcRouter } from "../../src/api/routes/oauth2/applications/#application_id/rpc";
import { toApplicationRpcResponse, type ApplicationRpcRepositories } from "../../src/api/routes/applications/#application_id/rpc";
import { DiscordApiErrors } from "../../src/util";

const coveredManifestId = "api:http:GET:/oauth2/applications/:application_id/rpc/";
const assignedPath = "/oauth2/applications/{application_id}/rpc";
const routeSourceFile = "src/api/routes/oauth2/applications/#application_id/rpc.ts";

type JsonSchema = {
    $ref?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
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
        redirect_uris: ["https://private.example/callback"],
        interactions_endpoint_url: "https://private.example/interactions",
        custom_install_url: "https://private.example/install",
        ...overrides,
    };
}

function createApp(repositories: ApplicationRpcRepositories) {
    const app = express();
    app.use(express.json());
    app.use("/oauth2/applications/:application_id/rpc", createOAuth2ApplicationRpcRouter(repositories));
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

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("GET /oauth2/applications/:application_id/rpc", () => {
    test("declares the OAuth2 RPC alias as public and no broader OAuth2 application routes", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/oauth2/applications/880218394199220334/rpc"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/oauth2/applications/880218394199220334/rpc/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/oauth2/applications/880218394199220334/rpc"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/oauth2/applications/880218394199220334/assets"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/oauth2/applications/880218394199220334/tokens"), false);
    });

    test("returns the same locally backed application RPC projection as the non-OAuth2 route", async (t: TestContext) => {
        const calls: unknown[] = [];
        const applicationRepository = {
            findOne: t.mock.fn(async (options: unknown) => {
                calls.push(options);
                return makeApplication() as never;
            }),
        };
        const app = createApp({ applicationRepository });

        const response = await requestJson(app, "/oauth2/applications/880218394199220334/rpc");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, toApplicationRpcResponse(makeApplication() as never));
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

    test("returns the shared unknown application response for the OAuth2 alias", async () => {
        const app = createApp({
            applicationRepository: {
                findOne: async () => null,
            },
        });

        const response = await requestJson(app, "/oauth2/applications/100000000000000009/rpc");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
    });

    test("documents route metadata for the generated source catalog", () => {
        const routeSource = readFileSync(join(process.cwd(), routeSourceFile), "utf8");

        assert.match(routeSource, /summary:\s*"Get RPC Application"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ApplicationRpcResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /401:\s*\{/);
    });

    test("generates source catalog, missing-route, OpenAPI, manifest, and contract metadata", () => {
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
        const openapi = readJson<{
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
        }>(join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                id?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedPath);
        assert.equal(sourceEntry?.route_name, "GET_OAUTH2_APPLICATIONS_APPLICATION_ID_RPC");
        assert.equal(sourceEntry?.source, routeSourceFile);
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ApplicationRpcResponse"]);
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/oauth2/applications/{param}/rpc"),
            false,
        );

        const route = openapi.paths?.["/oauth2/applications/{application_id}/rpc/"]?.get;
        assert.equal(route?.security, undefined);
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationRpcResponse");
        assert.equal(route?.responses?.["401"], undefined);
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapi.components?.schemas?.ApplicationRpcResponse?.required?.includes("verify_key"), true);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "public");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "ApplicationRpcResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 404]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "public");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "ApplicationRpcResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 404]);
    });
});
