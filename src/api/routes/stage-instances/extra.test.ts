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
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import type { StageInstancesExtraDependencies } from "@spacebar/api";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../middlewares";
import express from "express";
import { requestJson } from "../../tests/helpers/UserRouteTestHelpers";

const requireModule = require;
const routeModulePath = require.resolve("./extra");
const userId = "100000000000000001";
const coveredManifestId = "api:http:GET:/stage-instances/extra/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /stage-instances/extra", () => {
    test("declares authenticated local stage-instance extra metadata", (t) => {
        const routeOptions = captureRouteOptions(t);

        assert.deepEqual(routeOptions[0], {
            summary: "Get Stage Instance Extra Data",
            description:
                "Returns the authenticated user's visible persisted stage instances. Spacebar does not currently persist Discord-only extra stage discovery, participant, voice-state, or guild metadata.",
            responses: {
                200: {
                    body: "StageInstancesExtraResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(Authentication);
        app.use("/stage-instances/extra", loadRouteModule().default);
        app.use(ErrorHandler);

        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/stage-instances/extra"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/stage-instances/extra/"), false);

        const response = await requestJson(app, "/stage-instances/extra");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("returns the dependency-backed visible stage-instance subset", async () => {
        const visibleStageInstances = [
            {
                id: "840647391636226060",
                guild_id: "197038439483310086",
                channel_id: "733488538393510049",
                topic: "Server Q&A",
                privacy_level: 2,
                discoverable_disabled: false,
                guild_scheduled_event_id: null,
            },
        ];
        const calls: string[] = [];
        const dependencies: StageInstancesExtraDependencies = {
            listRequesterGuildMemberships: async (requesterId) => {
                calls.push(`memberships:${requesterId}`);
                return [{ guild_id: "197038439483310086" }];
            },
            listStageInstancesByGuildIds: async (guildIds) => {
                calls.push(`stage-instances:${guildIds.join(",")}`);
                return visibleStageInstances;
            },
            canViewStageInstance: async (requesterId, stageInstance) => {
                calls.push(`visible:${requesterId}:${stageInstance.channel_id}`);
                return true;
            },
        };
        const app = express();
        app.use((req, _res, next) => {
            req.user_id = userId;
            next();
        });
        app.use("/stage-instances/extra", loadRouteModule().createStageInstancesExtraRouter(dependencies));
        app.use(ErrorHandler);

        const response = await requestJson(app, "/stage-instances/extra");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, visibleStageInstances);
        assert.deepEqual(calls, [`memberships:${userId}`, "stage-instances:197038439483310086", `visible:${userId}:733488538393510049`]);
    });

    test("generated artifacts own only the xHyroM-backed GET extra route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "stage-instances", "extra.ts"), "utf8");
        const schemas = readJson<Record<string, { type?: string; items?: { $ref?: string } }>>(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<string, { get?: { responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>; security?: unknown } }>;
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                source?: string;
                response_schema_refs?: string[];
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(path.join("packages", "missing-routes", "missing.json"));
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{ contracts?: { manifestId?: string; sourceFile?: string; routeMetadata?: { responses?: string[] } }[] }>(
            path.join("test", "generated", "http-contracts.json"),
        );

        assert.match(routeSource, /router\.get\(\s*["']\/["']/);
        assert.match(routeSource, /body:\s*"StageInstancesExtraResponse"/);
        assert.doesNotMatch(routeSource, /router\.(delete|patch|post)\(/);
        assert.doesNotMatch(routeSource, /\b(GuildScheduledEvent|VoiceState|Participant|DiscoverableGuild)\b/);

        assert.equal(schemas.StageInstancesExtraResponse?.type, "array");
        assert.equal(schemas.StageInstancesExtraResponse?.items?.$ref, "#/definitions/StageInstanceResponse");

        const openapiRoute = openapi.paths?.["/stage-instances/extra/"]?.get;
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StageInstancesExtraResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/stage-instances/extra");
        assert.equal(sourceRoute?.route_name, "GET_STAGE_INSTANCES_EXTRA");
        assert.equal(sourceRoute?.source, "src/api/routes/stage-instances/extra.ts");
        assert.equal(sourceRoute?.response_schema_refs?.includes("StageInstancesExtraResponse"), true);
        assert.equal(sourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/stage-instances/extra"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "DELETE" && entry.route === "/stage-instances/extra"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PATCH" && entry.route === "/stage-instances/extra"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/stage-instances/extra.ts");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StageInstancesExtraResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 401]);

        const contractEntry = contractMatrix.contracts?.find((contract) => contract.manifestId === coveredManifestId);
        assert.equal(contractEntry?.sourceFile, "src/api/routes/stage-instances/extra.ts");
        assert.equal(contractEntry?.routeMetadata?.responses?.includes("StageInstancesExtraResponse"), true);
    });
});

function loadRouteModule(): typeof import("./extra") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./extra");
}

function captureRouteOptions(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: unknown, _res: unknown, next: () => void) => next();
    });

    loadRouteModule();

    return routeOptions;
}

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf8")) as T;
}
