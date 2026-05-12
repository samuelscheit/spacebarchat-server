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
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import surveyRouter, { buildUserSurveyResponse } from "../../src/api/routes/users/@me/survey";

const coveredManifestIds = ["api:http:GET:/users/@me/survey/"];

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    anyOf?: JsonSchema[];
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
};

describe("GET /users/@me/survey", () => {
    test("declares the current-user survey manifest route id covered by this suite", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/survey/"]);
    });

    test("returns no active survey without fabricating private survey state", () => {
        assert.deepEqual(buildUserSurveyResponse("1044657759066525777"), { survey: null });
    });

    test("returns the authenticated compatibility response and accepts documented query params", async () => {
        const response = await requestJson(createRouteApp(), "/users/@me/survey?disable_auto_seen=true&survey_override=1301267751645483122");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { survey: null });
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    });

    test("stays behind bearer auth and leaves survey-seen acknowledgement unimplemented", async () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "survey.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get User Survey"/);
        assert.match(routeSource, /body:\s*"UserSurveyResponse"/);
        assert.doesNotMatch(routeSource, /router\.post\(/);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/survey"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/survey?disable_auto_seen=true"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/users/@me/survey/1301267751645483122/seen"), false);

        const response = await requestJson(createRouteApp({ authentication: true }), "/users/@me/survey");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("generates response schema, query metadata, route catalogs, contracts, and suite coverage", () => {
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; in?: string; schema?: JsonSchema }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    post?: unknown;
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                source?: string;
                route_name?: string;
                response_schema_refs?: string[];
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    hasQuery?: boolean;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                manifestId?: string;
                authMode?: string;
                path?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { id?: string; manifestIds?: string[]; testFiles?: string[] }[] }[] }>(
            join(process.cwd(), "test", "generated", "suite-coverage.json"),
        );
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(
            join(process.cwd(), "packages", "missing-routes", "missing.json"),
        );

        const surveyResponse = schemas.UserSurveyResponse;
        const surveyProperty = surveyResponse.properties?.survey;
        assert.deepEqual(surveyResponse.required, ["survey"]);
        assert.equal(
            surveyProperty?.anyOf?.some((option) => option.$ref === "#/definitions/UserSurvey"),
            true,
        );
        assert.equal(
            surveyProperty?.anyOf?.some((option) => option.type === "null"),
            true,
        );
        assert.deepEqual(schemas.UserSurvey.required?.sort(), ["cta", "guild_permissions", "guild_requirements", "guild_size", "id", "key", "prompt", "url"]);
        assert.equal(schemas.UserSurvey.properties?.guild_size?.type, "array");

        const route = openapi.paths?.["/users/@me/survey/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UserSurveyResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(
            route?.parameters?.some((parameter) => parameter.in === "query" && parameter.name === "disable_auto_seen" && parameter.schema?.type === "boolean"),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.in === "query" && parameter.name === "survey_override" && parameter.schema?.type === "string"),
            true,
        );
        assert.equal(openapi.paths?.["/users/@me/survey/"]?.post, undefined);

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/survey");
        assert.deepEqual(sourceEntry, {
            method: "GET",
            response_schema_refs: ["APIErrorResponse", "UserSurveyResponse"],
            route: "/users/@me/survey",
            route_name: "GET_USERS__ME_SURVEY",
            source: "src/api/routes/users/@me/survey.ts",
        });
        assert.equal(
            sourceCatalog.some((entry) => entry.route === "/users/@me/survey/{param}/seen"),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/survey.ts");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "UserSurveyResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/users/@me/survey/");
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "UserSurveyResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401],
        );

        const usersSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "users");
        assert.ok(usersSuite?.manifestIds?.includes(coveredManifestIds[0]));
        assert.ok(usersSuite?.testFiles?.includes("test/scenarios/users-profile-settings.test.ts"));

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/@me/survey" && entry.route_name === "GET_USERS__ME_SURVEY"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/users/@me/survey/{param}/seen"),
            true,
        );
    });
});

function createRouteApp(options: { authentication?: boolean } = {}) {
    const app = express();

    if (options.authentication) {
        app.use(Authentication);
    } else {
        app.use((req, _res, next) => {
            req.user_id = "1044657759066525777";
            next();
        });
    }
    app.use("/users/@me/survey", surveyRouter);
    app.use(ErrorHandler);

    return app;
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
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
            headers: response.headers,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
