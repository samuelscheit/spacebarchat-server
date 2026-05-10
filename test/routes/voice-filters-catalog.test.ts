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
import { join } from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import voiceFiltersCatalogRouter, {
    buildVoiceFiltersCatalogResponse,
    createVoiceFiltersCatalogRouter,
    getVoiceFiltersCatalog,
    parseVoiceFiltersCatalogQuery,
    type VoiceFiltersCatalogProvider,
} from "../../src/api/routes/voice-filters/catalog";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";

const coveredManifestIds = ["api:http:GET:/voice-filters/catalog/"];

const catalog = {
    limited_time_voices: {
        current_set: ["solara"],
        current_set_start: "2025-05-22T00:00:00+00:00",
        current_set_end: "2025-05-22T23:59:59+00:00",
        next_set: ["robot"],
        next_set_start: "2025-05-23T00:00:00+00:00",
        next_set_end: "2025-05-23T23:59:59+00:00",
    },
    models: {
        vocoder_large_1: { url: "https://cdn.discordapp.com/assets/content/vocoder.onnx" },
        pitch_small_3: { url: "https://cdn.discordapp.com/assets/content/pitch.onnx" },
    },
    voices: [
        {
            id: "skye",
            models: ["vocoder_large_1", "pitch_small_3"],
            requires_premium: true,
            limited_time_free_starts: "2025-05-22T00:00:00+00:00",
            limited_time_free_ends: "2025-05-22T23:59:59+00:00",
            available: true,
        },
    ],
};

describe("GET /voice-filters/catalog", () => {
    test("declares the assigned manifest route id and stays behind bearer authentication", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/voice-filters/catalog/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/voice-filters/catalog?vfm_version=6"), false);

        const response = await requestJson(createAuthenticatedRouteApp(), "/voice-filters/catalog?vfm_version=6");
        const body = response.body as { code?: unknown; message?: unknown };

        assert.equal(response.status, 401);
        assert.equal(body.code, 401);
        assert.equal(body.message, "Error: Missing Authorization Header");
    });

    test("parses the documented vfm_version and model query fields", () => {
        assert.deepEqual(
            parseVoiceFiltersCatalogQuery({
                vfm_version: "6",
                models: ["vocoder_large_1,pitch_small_3", "vocoder_large_1"],
                "models[]": "asr_large",
            }),
            {
                vfm_version: 6,
                models: ["vocoder_large_1", "pitch_small_3", "asr_large"],
            },
        );

        assert.throws(() => parseVoiceFiltersCatalogQuery({ models: "vocoder_large_1" }), {
            message: "Invalid Form Body",
        });
        assert.throws(() => parseVoiceFiltersCatalogQuery({ vfm_version: "six" }), {
            message: "Invalid Form Body",
        });
    });

    test("returns an empty compatible catalog without fabricating voice filters or model assets", async () => {
        const app = createRouteApp();
        const response = await requestJson(app, "/voice-filters/catalog?vfm_version=6");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            limited_time_voices: {
                current_set: [],
                next_set: [],
            },
            models: {},
            voices: [],
        });
        assert.deepEqual(
            response.body,
            buildVoiceFiltersCatalogResponse(getVoiceFiltersCatalog({ vfm_version: 6, models: [] }), {
                vfm_version: 6,
                models: [],
            }),
        );
    });

    test("filters requested models and serializes module v6 voice model references conservatively", async () => {
        let receivedOptions: unknown;
        const provider: VoiceFiltersCatalogProvider = (options) => {
            receivedOptions = options;
            return catalog;
        };

        const response = await requestJson(createRouteApp(provider), "/voice-filters/catalog?vfm_version=6&models=vocoder_large_1&models=unknown&models[]=pitch_small_3");

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            vfm_version: 6,
            models: ["vocoder_large_1", "unknown", "pitch_small_3"],
        });
        assert.deepEqual((response.body as { models?: unknown }).models, {
            vocoder_large_1: { url: "https://cdn.discordapp.com/assets/content/vocoder.onnx" },
            pitch_small_3: { url: "https://cdn.discordapp.com/assets/content/pitch.onnx" },
        });
        assert.deepEqual((response.body as { voices?: { models?: unknown }[] }).voices?.[0]?.models, {});

        const legacyResponse = buildVoiceFiltersCatalogResponse(catalog, { vfm_version: 5, models: [] });
        assert.deepEqual(legacyResponse.models, catalog.models);
        assert.deepEqual(legacyResponse.voices?.[0]?.models, ["vocoder_large_1", "pitch_small_3"]);
    });

    test("rejects missing or invalid vfm_version queries with field errors", async () => {
        const missingResponse = await requestJson(createRouteApp(), "/voice-filters/catalog?models=vocoder_large_1");
        assert.equal(missingResponse.status, 400);
        assert.deepEqual(missingResponse.body, {
            code: 50035,
            message: "Invalid Form Body",
            errors: {
                vfm_version: {
                    _errors: [
                        {
                            code: "BASE_TYPE_REQUIRED",
                            message: "vfm_version is required",
                        },
                    ],
                },
            },
        });

        const invalidResponse = await requestJson(createRouteApp(), "/voice-filters/catalog?vfm_version=-1");
        assert.equal(invalidResponse.status, 400);
        assert.deepEqual((invalidResponse.body as { errors?: { vfm_version?: { _errors?: { code?: string }[] } } }).errors?.vfm_version?._errors?.[0]?.code, "BASE_TYPE_INVALID");
    });

    test("declares generated schema, OpenAPI, manifest, and source-catalog metadata", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; in?: string; required?: boolean; schema?: { type?: string } }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                        summary?: string;
                    };
                }
            >;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                authMode?: string;
                routeMetadata?: {
                    hasQuery?: boolean;
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
            response_schema_refs?: string[];
        }[];

        assert.equal(schemas.VoiceFiltersCatalogResponse.properties?.limited_time_voices?.$ref, "#/definitions/VoiceFiltersCatalogLimitedTimeVoicesResponse");
        assert.equal(schemas.VoiceFiltersCatalogLimitedTimeVoicesResponse.properties?.current_set?.items?.type, "string");
        assert.equal(schemas.VoiceFilterModelResponse.properties?.url?.type, "string");
        assert.equal(schemas.VoiceFilterResponse.properties?.id?.type, "string");

        const route = openapi.paths?.["/voice-filters/catalog/"]?.get;
        assert.equal(route?.summary, "Get Voice Filters Catalog");
        assert.equal(route?.parameters?.find((parameter) => parameter.name === "vfm_version")?.required, true);
        assert.equal(route?.parameters?.find((parameter) => parameter.name === "vfm_version")?.schema?.type, "integer");
        assert.equal(route?.parameters?.find((parameter) => parameter.name === "models")?.schema?.type, "array");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/VoiceFiltersCatalogResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("VoiceFiltersCatalogResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(400), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/voice-filters/catalog");
        assert.equal(sourceEntry?.response_schema_refs?.includes("VoiceFiltersCatalogResponse"), true);
        assert.equal(sourceEntry?.response_schema_refs?.includes("APIErrorResponse"), true);
    });
});

function createRouteApp(catalogProvider?: VoiceFiltersCatalogProvider) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "user-id";
        next();
    });
    app.use("/voice-filters/catalog", createVoiceFiltersCatalogRouter(catalogProvider));
    app.use(ErrorHandler);
    return app;
}

function createAuthenticatedRouteApp() {
    const app = express();
    app.use(Authentication);
    app.use("/voice-filters/catalog", voiceFiltersCatalogRouter);
    app.use(ErrorHandler);
    return app;
}

type JsonSchema = {
    type?: string;
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
};
