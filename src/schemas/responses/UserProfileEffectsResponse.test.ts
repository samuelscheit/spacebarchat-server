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
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ajv } from "../Validator";

const assetsPath = path.join(process.cwd(), "assets");

interface JsonShape {
    $ref?: string;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    type?: string | string[];
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

function profileEffectResponse() {
    return {
        profile_effect_configs: [
            {
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
            },
        ],
    };
}

function assertUserProfileEffectDefinitionsUseScopedNames(schemas: Record<string, JsonShape>, refPrefix: string) {
    assert.equal(schemas.UserProfileEffectsResponse.properties?.profile_effect_configs?.items?.$ref, `${refPrefix}UserProfileEffectConfig`);
    assert.equal(schemas.UserProfileEffectConfig.properties?.effects?.items?.$ref, `${refPrefix}UserProfileEffectAnimation`);
    assert.equal(schemas.UserProfileEffectAnimation.properties?.position?.$ref, `${refPrefix}UserProfileEffectPosition`);
    assert.equal(schemas.UserProfileEffectAnimation.properties?.randomizedSources?.items?.$ref, `${refPrefix}UserProfileEffectSource`);

    assert.ok(schemas.UserProfileEffectsResponse);
    assert.ok(schemas.UserProfileEffectConfig);
    assert.ok(schemas.UserProfileEffectAnimation);
    assert.ok(schemas.UserProfileEffectPosition);
    assert.ok(schemas.UserProfileEffectSource);
}

test("UserProfileEffectsResponse uses profile-effect scoped schema definitions", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");

    assertUserProfileEffectDefinitionsUseScopedNames(schemas, "#/definitions/");
});

test("UserProfileEffectsResponse uses profile-effect scoped OpenAPI definitions", () => {
    const openapi = readAssetJson<{
        components: { schemas: Record<string, JsonShape> };
    }>("openapi.json");

    assertUserProfileEffectDefinitionsUseScopedNames(openapi.components.schemas, "#/components/schemas/");
});

test("UserProfileEffectsResponse validates profile effect config wrappers", () => {
    const response = profileEffectResponse();

    assert.equal(ajv.validate("UserProfileEffectsResponse", response), true);
    assert.equal(
        ajv.validate("UserProfileEffectsResponse", {
            profile_effect_configs: [{ ...response.profile_effect_configs[0], internal_field: true }],
        }),
        false,
    );
    assert.equal(
        ajv.validate("UserProfileEffectsResponse", {
            profile_effect_configs: [
                {
                    ...response.profile_effect_configs[0],
                    effects: [
                        {
                            ...response.profile_effect_configs[0].effects[0],
                            randomizedSources: [{ src: "https://cdn.discordapp.com/profile-effects/confetti-alt.png", internal_field: true }],
                        },
                    ],
                },
            ],
        }),
        false,
    );
});
