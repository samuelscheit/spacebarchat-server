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
import type { UserProfileEffectConfig } from "@spacebar/schemas";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import userProfileEffectsRouter, {
    buildUserProfileEffectsResponse,
    createUserProfileEffectsRouter,
    getUserProfileEffectsCatalog,
    parseUserProfileEffectsQuery,
    type UserProfileEffectsCatalogProvider,
    type UserProfileEffectsQueryOptions,
} from "../../src/api/routes/user-profile-effects";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";

const coveredManifestIds = ["api:http:GET:/user-profile-effects/"];

function profileEffect(): UserProfileEffectConfig {
    return {
        type: 1,
        id: "profile-effect-id",
        sku_id: "profile-effect-sku",
        title: "Confetti",
        description: "A celebratory profile effect",
        accessibilityLabel: "Confetti profile effect",
        animationType: 1,
        thumbnailPreviewSrc: "https://cdn.discordapp.com/profile-effects/confetti-preview.png",
        reducedMotionSrc: "https://cdn.discordapp.com/profile-effects/confetti-reduced.png",
        staticFrameSrc: "https://cdn.discordapp.com/profile-effects/confetti-static.png",
        effects: [
            {
                src: "https://cdn.discordapp.com/profile-effects/confetti.png",
                loop: true,
                height: 320,
                width: 480,
                duration: 1200,
                start: 0,
                loopDelay: 250,
                position: {
                    x: 0,
                    y: 12,
                },
                zIndex: 1,
                randomizedSources: [{ src: "https://cdn.discordapp.com/profile-effects/confetti-alt.png" }],
            },
        ],
    };
}

function createApp(catalogProvider?: UserProfileEffectsCatalogProvider) {
    const app = express();
    app.use("/user-profile-effects", createUserProfileEffectsRouter(catalogProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();
    app.use(Authentication);
    app.use("/user-profile-effects", userProfileEffectsRouter);
    app.use(ErrorHandler);

    return app;
}

describe("GET /user-profile-effects", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/user-profile-effects/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/user-profile-effects?locale=en-US"), false);

        const response = await requestJson(createAuthenticatedApp(), "/user-profile-effects");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("parses documented query fields and returns provided profile effects", async () => {
        const profileEffects = [profileEffect()];
        let receivedOptions: UserProfileEffectsQueryOptions | undefined;
        const provider: UserProfileEffectsCatalogProvider = (options) => {
            receivedOptions = options;
            return profileEffects;
        };

        const response = await requestJson(createApp(provider), "/user-profile-effects?locale=en-US&with_unpublished=true");

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            locale: "en-US",
            with_unpublished: true,
        });
        assert.deepEqual(response.body, buildUserProfileEffectsResponse(profileEffects));
    });

    test("returns an empty compatible response without fabricating profile effect assets", async () => {
        assert.deepEqual(getUserProfileEffectsCatalog(), []);
        assert.deepEqual(
            parseUserProfileEffectsQuery({
                locale: ["de-DE", "en-US"],
                with_unpublished: "invalid",
            } as never),
            {
                locale: "de-DE",
                with_unpublished: undefined,
            },
        );

        const response = await requestJson(createApp(), "/user-profile-effects?locale=en-US");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { profile_effect_configs: [] });
    });

    test("declares deprecated authenticated response metadata in generated route artifacts", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        deprecated?: boolean;
                        parameters?: { name?: string; in?: string; schema?: { type?: string } }[];
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

        assert.equal(schemas.UserProfileEffectsResponse.properties?.profile_effect_configs?.items?.$ref, "#/definitions/UserProfileEffectConfig");

        const route = openapi.paths?.["/user-profile-effects/"]?.get;
        assert.equal(route?.summary, "Get Profile Effects");
        assert.equal(route?.deprecated, true);
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UserProfileEffectsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.parameters?.find((parameter) => parameter.name === "locale")?.schema?.type, "string");
        assert.equal(route?.parameters?.find((parameter) => parameter.name === "with_unpublished")?.schema?.type, "boolean");

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("UserProfileEffectsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
    });
});

type JsonSchema = {
    type?: string;
    $ref?: string;
    items?: { $ref?: string };
    properties?: Record<string, JsonSchema>;
};
