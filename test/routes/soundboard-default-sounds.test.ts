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
import { Authentication, ErrorHandler } from "../../src/api/middlewares";
import soundboardDefaultSoundsRouter, { buildDefaultSoundboardSoundsResponse } from "../../src/api/routes/soundboard-default-sounds";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";

const coveredManifestIds = ["api:http:GET:/soundboard-default-sounds/"];

describe("GET /soundboard-default-sounds", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/soundboard-default-sounds/"]);
    });

    test("returns an empty default soundboard catalog until default sounds are locally available", async () => {
        const app = createAuthenticatedRouteApp();
        const response = await requestJson(app, "/soundboard-default-sounds");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.deepEqual(response.body, buildDefaultSoundboardSoundsResponse());
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(Authentication);
        app.use("/soundboard-default-sounds", soundboardDefaultSoundsRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/soundboard-default-sounds");
        const body = response.body as { code?: unknown; message?: unknown };

        assert.equal(response.status, 401);
        assert.equal(body.code, 401);
        assert.equal(body.message, "Error: Missing Authorization Header");
    });

    test("declares response schema and authenticated generated route metadata", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<string, { get?: { responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>; security?: unknown } }>;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };

        const responseSchema = schemas.SoundboardDefaultSoundsResponse;
        assert.equal(responseSchema.type, "array");
        assert.equal(responseSchema.items?.$ref, "#/definitions/SoundboardSoundResponse");
        assert.equal(schemas.SoundboardSoundResponse.properties?.sound_id?.type, "string");
        assert.equal(schemas.SoundboardSoundResponse.properties?.name?.type, "string");
        assert.equal(schemas.SoundboardSoundResponse.properties?.volume?.$ref, "#/definitions/SoundboardVolume");
        assert.equal(schemas.SoundboardVolume.type, "number");
        assert.equal(schemas.SoundboardSoundResponse.properties?.available?.type, "boolean");

        const route = openapi.paths?.["/soundboard-default-sounds/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/SoundboardDefaultSoundsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("SoundboardDefaultSoundsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
    });
});

function createAuthenticatedRouteApp() {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "user-id";
        next();
    });
    app.use("/soundboard-default-sounds", soundboardDefaultSoundsRouter);
    app.use(ErrorHandler);
    return app;
}

type JsonSchema = {
    type?: string;
    $ref?: string;
    items?: { $ref?: string };
    definitions?: Record<string, JsonSchema>;
    properties?: Record<string, JsonSchema>;
};
