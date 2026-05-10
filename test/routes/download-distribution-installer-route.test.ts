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
import { ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import { ClientRelease } from "@spacebar/util";
import express, { type Request } from "express";
import distributedInstallerRouter, {
    DISTRIBUTED_INSTALLER_ARCHITECTURES,
    DISTRIBUTED_INSTALLER_CHANNELS,
    DISTRIBUTED_INSTALLER_NOT_FOUND,
    DISTRIBUTED_INSTALLER_PLATFORMS,
    parseDistributedInstallerQuery,
} from "../../src/api/routes/downloads/distributions/app/installers/latest";

const manifestId = "api:http:GET:/downloads/distributions/app/installers/latest/";

type JsonSchema = {
    $ref?: string;
    type?: string;
};

describe("GET /downloads/distributions/app/installers/latest", () => {
    test("declares source-backed public redirect metadata", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "downloads", "distributions", "app", "installers", "latest.ts"), "utf8");

        assert.match(routeSource, /router\.get\(\s*"\/"/);
        assert.match(routeSource, /summary:\s*"Get Latest Distributed Application Installer"/);
        assert.match(routeSource, /channel:\s*\{\s*type:\s*"string",\s*required:\s*true/s);
        assert.match(routeSource, /platform:\s*\{\s*type:\s*"string",\s*required:\s*true/s);
        assert.match(routeSource, /arch:\s*\{\s*type:\s*"string",\s*required:\s*true/s);
        assert.match(routeSource, /302:\s*\{\}/);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/downloads/distributions/app/installers/latest?channel=stable&platform=win&arch=x64"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/downloads/distributions/app/installers/latest/?channel=stable&platform=win&arch=x64"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/downloads/distributions/app/installers/latest/extra"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/downloads/distributions/app/installers/latest"), false);
    });

    test("validates required Windows distribution query dimensions", () => {
        assert.deepEqual(DISTRIBUTED_INSTALLER_CHANNELS, ["stable", "ptb", "canary", "development"]);
        assert.deepEqual(DISTRIBUTED_INSTALLER_PLATFORMS, ["win"]);
        assert.deepEqual(DISTRIBUTED_INSTALLER_ARCHITECTURES, ["x86", "x64", "arm64"]);
        assert.deepEqual(
            parseDistributedInstallerQuery({
                query: { channel: "stable", platform: "win", arch: "x64" },
            } as unknown as Request),
            { channel: "stable", platform: "win", arch: "x64" },
        );
        assert.throws(
            () =>
                parseDistributedInstallerQuery({
                    query: { channel: "mobile", platform: "linux", arch: "sparc" },
                    t: (key: string) => key,
                } as unknown as Request),
            (error: unknown) => {
                const errors = (error as { errors?: { channel?: { _errors?: { code?: string }[] }; platform?: { _errors?: { code?: string }[] } } }).errors;
                return errors?.channel?._errors?.[0]?.code === "BASE_TYPE_CHOICES" && errors.platform?._errors?.[0]?.code === "BASE_TYPE_CHOICES";
            },
        );
    });

    test("redirects to the newest matching enabled distributed installer release", async (t) => {
        const findCalls: unknown[] = [];
        t.mock.method(ClientRelease, "findOne", async (options: unknown) => {
            findCalls.push(options);
            return { url: "https://stable.dl.example.invalid/distro/app/stable/win/x64/1.0.1/DiscordSetup.exe" } as ClientRelease;
        });

        const response = await request(createRouteApp(), "/downloads/distributions/app/installers/latest?channel=stable&platform=win&arch=x64", {
            redirect: "manual",
        });

        assert.equal(response.status, 302);
        assert.equal(response.headers.get("location"), "https://stable.dl.example.invalid/distro/app/stable/win/x64/1.0.1/DiscordSetup.exe");
        assert.deepEqual(findCalls, [
            {
                where: {
                    enabled: true,
                    release_channel: "stable",
                    platform: "win",
                    arch: "x64",
                },
                order: { pub_date: "DESC" },
            },
        ]);
    });

    test("returns JSON errors for missing query dimensions, unsupported dimensions, and absent releases", async (t) => {
        const findOne = t.mock.method(ClientRelease, "findOne", async () => null);

        const missingQuery = await request(createRouteApp(), "/downloads/distributions/app/installers/latest");
        assert.equal(missingQuery.status, 400);
        assert.equal((missingQuery.body as { code?: number }).code, 50035);
        assert.equal((missingQuery.body as { errors?: { channel?: { _errors?: { code?: string }[] } } }).errors?.channel?._errors?.[0]?.code, "BASE_TYPE_REQUIRED");
        assert.equal((missingQuery.body as { errors?: { platform?: { _errors?: { code?: string }[] } } }).errors?.platform?._errors?.[0]?.code, "BASE_TYPE_REQUIRED");
        assert.equal((missingQuery.body as { errors?: { arch?: { _errors?: { code?: string }[] } } }).errors?.arch?._errors?.[0]?.code, "BASE_TYPE_REQUIRED");
        assert.equal(findOne.mock.callCount(), 0);

        const unsupportedQuery = await request(createRouteApp(), "/downloads/distributions/app/installers/latest?channel=mobile&platform=linux&arch=sparc");
        assert.equal(unsupportedQuery.status, 400);
        assert.equal((unsupportedQuery.body as { errors?: { channel?: { _errors?: { code?: string }[] } } }).errors?.channel?._errors?.[0]?.code, "BASE_TYPE_CHOICES");
        assert.equal((unsupportedQuery.body as { errors?: { platform?: { _errors?: { code?: string }[] } } }).errors?.platform?._errors?.[0]?.code, "BASE_TYPE_CHOICES");
        assert.equal((unsupportedQuery.body as { errors?: { arch?: { _errors?: { code?: string }[] } } }).errors?.arch?._errors?.[0]?.code, "BASE_TYPE_CHOICES");
        assert.equal(findOne.mock.callCount(), 0);

        const missingRelease = await request(createRouteApp(), "/downloads/distributions/app/installers/latest?channel=ptb&platform=win&arch=arm64");
        assert.equal(missingRelease.status, 404);
        assert.deepEqual(missingRelease.body, {
            code: DISTRIBUTED_INSTALLER_NOT_FOUND.code,
            message: DISTRIBUTED_INSTALLER_NOT_FOUND.message,
        });
        assert.equal(findOne.mock.callCount(), 1);
    });

    test("generates source catalog, OpenAPI, testing manifest, and contract metadata", () => {
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            route?: string;
            route_name?: string;
            response_schema_refs?: string[];
            source?: string;
        }[];
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; in?: string; required?: boolean; schema?: JsonSchema }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                    hasQuery?: boolean;
                };
            }[];
        };
        const contracts = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                manifestId?: string;
                authMode?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/downloads/distributions/app/installers/latest");
        assert.equal(sourceEntry?.route_name, "GET_DOWNLOADS_DISTRIBUTIONS_APP_INSTALLERS_LATEST");
        assert.equal(sourceEntry?.source, "src/api/routes/downloads/distributions/app/installers/latest.ts");
        assert.equal(sourceEntry?.response_schema_refs?.includes("APIErrorResponse"), true);

        const route = openapi.paths?.["/downloads/distributions/app/installers/latest/"]?.get;
        assert.equal(route?.security, undefined);
        assert.equal(route?.responses?.["302"] !== undefined, true);
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        for (const queryName of ["channel", "platform", "arch"]) {
            assert.equal(
                route?.parameters?.some((parameter) => parameter.name === queryName && parameter.in === "query" && parameter.required === true),
                true,
            );
        }

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [302, 400, 404]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === manifestId);
        assert.equal(contract?.authMode, "public");
        assert.equal(contract?.routeMetadata?.responses?.includes("APIErrorResponse"), true);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [302, 400, 404]);
    });
});

function createRouteApp() {
    const app = express();

    app.use((req, _res, next) => {
        (req as unknown as { t: (key: string) => string }).t = (key: string) => key;
        next();
    });
    app.use("/downloads/distributions/app/installers/latest", distributedInstallerRouter);
    app.use(ErrorHandler);

    return app;
}

async function request(app: express.Express, path: string, init?: RequestInit) {
    const { server, baseUrl } = await listen(app);

    try {
        const response = await fetch(`${baseUrl}${path}`, init);
        const contentType = response.headers.get("content-type") ?? "";

        return {
            status: response.status,
            headers: response.headers,
            body: contentType.includes("application/json") ? ((await response.json()) as unknown) : await response.text(),
        };
    } finally {
        await close(server);
    }
}

async function listen(app: express.Express) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");

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
