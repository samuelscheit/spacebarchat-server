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
import { describe, test, type TestContext } from "node:test";
import { ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import { ClientRelease } from "@spacebar/util";
import express, { type Request } from "express";
import updatesRouter, {
    UPDATE_NOT_FOUND,
    findLatestClientUpdate,
    isSupportedUpdateReleaseChannel,
    optionalUpdatePlatform,
    requireUpdatePlatform,
    serializeUpdateResponse,
} from "../../src/api/routes/updates";

const coveredManifestIds = ["api:http:GET:/updates/", "api:http:GET:/updates/:release_channel"];

type JsonSchema = {
    $ref?: string;
    type?: string;
};

describe("GET /updates/:release_channel", () => {
    test("declares the updates manifest route ids covered by this suite", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/updates/", "api:http:GET:/updates/:release_channel"]);
    });

    test("declares source-backed public update metadata", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "updates.ts"), "utf8");

        assert.match(routeSource, /router\.get\(\s*"\/:release_channel"/);
        assert.match(routeSource, /summary:\s*"Get Application Updates"/);
        assert.match(routeSource, /platform:\s*\{\s*type:\s*"string"/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"UpdatesResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/updates/stable?platform=osx"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/updates/canary/"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/updates/stable/extra"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/updates/stable"), false);
    });

    test("validates release channel support and platform parsing", () => {
        assert.equal(isSupportedUpdateReleaseChannel("stable"), true);
        assert.equal(isSupportedUpdateReleaseChannel("ptb"), true);
        assert.equal(isSupportedUpdateReleaseChannel("canary"), true);
        assert.equal(isSupportedUpdateReleaseChannel("development"), true);
        assert.equal(isSupportedUpdateReleaseChannel("mobile"), false);
        assert.equal(isSupportedUpdateReleaseChannel("unknown"), false);

        assert.equal(optionalUpdatePlatform({ query: {} } as unknown as Request), "osx");
        assert.equal(optionalUpdatePlatform({ query: { platform: "linux" } } as unknown as Request), "linux");
        assert.equal(optionalUpdatePlatform({ query: { platform: ["win", "linux"] } } as unknown as Request), "win");
        assert.equal(requireUpdatePlatform({ query: { platform: "linux" } } as unknown as Request), "linux");
        assert.throws(
            () => requireUpdatePlatform({ query: {}, t: (key: string) => key } as unknown as Request),
            (error: unknown) => (error as { code?: number; errors?: { platform?: { _errors?: { code?: string }[] } } }).code === 50035,
        );
    });

    test("serializes locally backed ClientRelease data without fabricating updater fields", () => {
        assert.deepEqual(
            serializeUpdateResponse({
                name: "0.0.75",
                pub_date: new Date("2023-07-05T17:16:10.000Z"),
                url: "https://cdn.example.test/DiscordPTB.zip",
                notes: undefined,
            } as ClientRelease),
            {
                name: "0.0.75",
                pub_date: "2023-07-05T17:16:10.000Z",
                url: "https://cdn.example.test/DiscordPTB.zip",
                notes: null,
            },
        );
    });

    test("queries the latest enabled release for the requested release channel and platform", async (t) => {
        const findCalls: unknown[] = [];
        t.mock.method(ClientRelease, "findOne", async (options: unknown) => {
            findCalls.push(options);
            return {
                name: "0.0.75",
                pub_date: new Date("2023-07-05T17:16:10.000Z"),
                url: "https://cdn.example.test/DiscordPTB.zip",
                notes: "",
            } as ClientRelease;
        });

        assert.equal((await findLatestClientUpdate({ platform: "osx", releaseChannel: "ptb" }))?.name, "0.0.75");
        assert.deepEqual(findCalls, [
            {
                where: {
                    enabled: true,
                    platform: "osx",
                    release_channel: "ptb",
                },
                order: { pub_date: "DESC" },
            },
        ]);
    });

    test("returns the default macOS release-channel update when platform is omitted", async (t) => {
        const findCalls = mockClientReleaseFindOne(t, {
            name: "0.0.75",
            pub_date: new Date("2023-07-05T17:16:10.000Z"),
            url: "https://cdn.example.test/DiscordPTB.zip",
            notes: "",
        } as ClientRelease);

        const response = await request(createRouteApp(), "/updates/ptb");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            name: "0.0.75",
            pub_date: "2023-07-05T17:16:10.000Z",
            url: "https://cdn.example.test/DiscordPTB.zip",
            notes: "",
        });
        assert.deepEqual(findCalls, [
            {
                where: {
                    enabled: true,
                    platform: "osx",
                    release_channel: "ptb",
                },
                order: { pub_date: "DESC" },
            },
        ]);
    });

    test("honors an explicit platform and fails closed for unsupported or absent release data", async (t) => {
        const findCalls = mockClientReleaseFindOne(t, null);

        const unsupported = await request(createRouteApp(), "/updates/mobile?platform=osx");
        assert.equal(unsupported.status, 404);
        assert.deepEqual(unsupported.body, {
            code: UPDATE_NOT_FOUND.code,
            message: UPDATE_NOT_FOUND.message,
        });
        assert.equal(findCalls.length, 0);

        const missingRelease = await request(createRouteApp(), "/updates/stable?platform=linux");
        assert.equal(missingRelease.status, 404);
        assert.deepEqual(missingRelease.body, {
            code: UPDATE_NOT_FOUND.code,
            message: UPDATE_NOT_FOUND.message,
        });
        assert.deepEqual(findCalls, [
            {
                where: {
                    enabled: true,
                    platform: "linux",
                    release_channel: "stable",
                },
                order: { pub_date: "DESC" },
            },
        ]);
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
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: { method?: string; route?: string }[];
        };
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

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/updates/{release_channel}");
        assert.equal(sourceEntry?.route_name, "GET_UPDATES_RELEASE_CHANNEL");
        assert.equal(sourceEntry?.source, "src/api/routes/updates.ts");
        assert.equal(sourceEntry?.response_schema_refs?.includes("APIErrorResponse"), true);
        assert.equal(sourceEntry?.response_schema_refs?.includes("UpdatesResponse"), true);
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/updates/{param}"),
            false,
        );

        const route = openapi.paths?.["/updates/{release_channel}"]?.get;
        assert.equal(route?.security, undefined);
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UpdatesResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "release_channel" && parameter.in === "path" && parameter.required === true),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "platform" && parameter.in === "query" && parameter.required !== true),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/updates/:release_channel");
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("UpdatesResponse"), true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 404]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === "api:http:GET:/updates/:release_channel");
        assert.equal(contract?.authMode, "public");
        assert.equal(contract?.routeMetadata?.responses?.includes("APIErrorResponse"), true);
        assert.equal(contract?.routeMetadata?.responses?.includes("UpdatesResponse"), true);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 404]);
    });
});

function mockClientReleaseFindOne(t: TestContext, release: ClientRelease | null) {
    const findCalls: unknown[] = [];
    t.mock.method(ClientRelease, "findOne", async (options: unknown) => {
        findCalls.push(options);
        return release;
    });
    return findCalls;
}

function createRouteApp() {
    const app = express();

    app.use((req, _res, next) => {
        (req as unknown as { t: (key: string) => string }).t = (key: string) => key;
        next();
    });
    app.use("/updates", updatesRouter);
    app.use(ErrorHandler);

    return app;
}

async function request(app: express.Express, path: string) {
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
