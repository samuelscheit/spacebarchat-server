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
import { ClientRelease } from "@spacebar/util";
import express, { type Request } from "express";
import downloadRouter, { DOWNLOAD_NOT_FOUND, MOBILE_DOWNLOAD_URL, isSupportedDownloadReleaseChannel, requireDownloadPlatform } from "../../src/api/routes/download";

const coveredManifestIds = ["api:http:GET:/download/", "api:http:GET:/download/:release_channel"];

type JsonSchema = {
    $ref?: string;
    type?: string;
};

describe("GET /download/:release_channel", () => {
    test("declares the download manifest route ids covered by this suite", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/download/", "api:http:GET:/download/:release_channel"]);
    });

    test("declares source-backed public redirect metadata", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "download.ts"), "utf8");

        assert.match(routeSource, /router\.get\(\s*"\/:release_channel"/);
        assert.match(routeSource, /summary:\s*"Get Latest Application Installer"/);
        assert.match(routeSource, /platform:\s*\{\s*type:\s*"string",\s*required:\s*true/s);
        assert.match(routeSource, /format:\s*\{\s*type:\s*"string"/s);
        assert.match(routeSource, /302:\s*\{\}/);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/download/stable?platform=linux&format=deb"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/download/mobile/"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/download/stable/extra"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/download/stable"), false);
    });

    test("validates release channel and required platform inputs", () => {
        assert.equal(isSupportedDownloadReleaseChannel("stable"), true);
        assert.equal(isSupportedDownloadReleaseChannel("ptb"), true);
        assert.equal(isSupportedDownloadReleaseChannel("canary"), true);
        assert.equal(isSupportedDownloadReleaseChannel("development"), true);
        assert.equal(isSupportedDownloadReleaseChannel("mobile"), true);
        assert.equal(isSupportedDownloadReleaseChannel("unknown"), false);

        assert.equal(requireDownloadPlatform({ query: { platform: "linux" } } as unknown as Request), "linux");
        assert.throws(
            () => requireDownloadPlatform({ query: {}, t: (key: string) => key } as unknown as Request),
            (error: unknown) => (error as { code?: number; errors?: { platform?: { _errors?: { code?: string }[] } } }).code === 50035,
        );
    });

    test("redirects desktop release-channel requests through the existing platform release lookup", async (t) => {
        const findCalls: unknown[] = [];
        t.mock.method(ClientRelease, "findOne", async (options: unknown) => {
            findCalls.push(options);
            return { url: "https://cdn.example.test/discord-linux.deb" } as ClientRelease;
        });

        const response = await request(createRouteApp(), "/download/stable?platform=linux&format=tar.gz", { redirect: "manual" });

        assert.equal(response.status, 302);
        assert.equal(response.headers.get("location"), "https://cdn.example.test/discord-linux.deb");
        assert.deepEqual(findCalls, [
            {
                where: {
                    enabled: true,
                    platform: "linux",
                },
                order: { pub_date: "DESC" },
            },
        ]);
    });

    test("redirects the special mobile release channel without requiring stored desktop releases", async (t) => {
        t.mock.method(ClientRelease, "findOne", async () => {
            throw new Error("mobile download should not query ClientRelease");
        });

        const response = await request(createRouteApp(), "/download/mobile", { redirect: "manual" });

        assert.equal(response.status, 302);
        assert.equal(response.headers.get("location"), MOBILE_DOWNLOAD_URL);
    });

    test("returns JSON errors for unsupported channels, missing platform, and absent releases", async (t) => {
        const findOne = t.mock.method(ClientRelease, "findOne", async () => null);

        const unsupported = await request(createRouteApp(), "/download/not-a-channel?platform=linux");
        assert.equal(unsupported.status, 404);
        assert.deepEqual(unsupported.body, {
            code: DOWNLOAD_NOT_FOUND.code,
            message: DOWNLOAD_NOT_FOUND.message,
        });
        assert.equal(findOne.mock.callCount(), 0);

        const missingPlatform = await request(createRouteApp(), "/download/stable");
        assert.equal(missingPlatform.status, 400);
        assert.equal((missingPlatform.body as { code?: number }).code, 50035);
        assert.equal((missingPlatform.body as { errors?: { platform?: { _errors?: { code?: string }[] } } }).errors?.platform?._errors?.[0]?.code, "BASE_TYPE_REQUIRED");

        const missingRelease = await request(createRouteApp(), "/download/stable?platform=linux");
        assert.equal(missingRelease.status, 404);
        assert.deepEqual(missingRelease.body, {
            code: DOWNLOAD_NOT_FOUND.code,
            message: DOWNLOAD_NOT_FOUND.message,
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

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/download/{release_channel}");
        assert.equal(sourceEntry?.route_name, "GET_DOWNLOAD_RELEASE_CHANNEL");
        assert.equal(sourceEntry?.source, "src/api/routes/download.ts");
        assert.equal(sourceEntry?.response_schema_refs?.includes("APIErrorResponse"), true);

        const route = openapi.paths?.["/download/{release_channel}"]?.get;
        assert.equal(route?.security, undefined);
        assert.equal(route?.responses?.["302"] !== undefined, true);
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "release_channel" && parameter.in === "path" && parameter.required === true),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "platform" && parameter.in === "query" && parameter.required === true),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "format" && parameter.in === "query"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/download/:release_channel");
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [302, 400, 404]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === "api:http:GET:/download/:release_channel");
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
    app.use("/download", downloadRouter);
    app.use(ErrorHandler);

    return app;
}

async function request(app: express.Express, path: string, init?: RequestInit) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`, init);
        const contentType = response.headers.get("content-type") ?? "";

        return {
            status: response.status,
            headers: response.headers,
            body: contentType.includes("application/json") ? ((await response.json()) as unknown) : await response.text(),
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
