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
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import type { QuestConfigResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import questConfigRouter, {
    UNKNOWN_QUEST,
    assertValidQuestConfigId,
    createQuestConfigRouter,
    getConfiguredQuestConfig,
    getQuestConfig,
    isQuestConfigActive,
    toQuestConfigResponse,
    type QuestConfigProvider,
} from "../../src/api/routes/quests/#quest_id/index";

const coveredManifestIds = ["api:http:GET:/quests/:quest_id/"];
const questId = "8206816794116096000";

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
};

describe("GET /quests/:quest_id", () => {
    test("returns only provider-backed active quest configs without extra provider fields", async () => {
        const source = {
            ...sampleQuestConfig,
            internal_notes: "do not serialize",
        } as QuestConfigResponse & { internal_notes: string };
        const response = await requestJson(
            createRouteApp(() => source),
            `/quests/${questId}`,
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, sampleQuestConfig);
        assert.equal((response.body as QuestConfigResponse & { internal_notes?: unknown }).internal_notes, undefined);
        assert.equal(isQuestConfigActive(sampleQuestConfig, new Date("2026-05-11T12:00:00.000Z")), true);
        assert.deepEqual(toQuestConfigResponse(source), sampleQuestConfig);
    });

    test("fails closed for absent, inactive, or malformed quest configs", async () => {
        let providerCalled = false;

        assert.equal(getConfiguredQuestConfig(questId), undefined);
        assert.doesNotThrow(() => assertValidQuestConfigId(questId));
        assert.throws(() => assertValidQuestConfigId("not-a-snowflake"), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
        assert.equal(isQuestConfigActive({ ...sampleQuestConfig, expires_at: "2000-01-01T00:00:00.000Z" }), false);
        await assert.rejects(() => getQuestConfig(questId, () => undefined), isUnknownQuestError);
        await assert.rejects(() => getQuestConfig(questId, () => ({ ...sampleQuestConfig, starts_at: "2099-01-01T00:00:00.000Z" })), isUnknownQuestError);
        await assert.rejects(
            () =>
                getQuestConfig("not-a-snowflake", () => {
                    providerCalled = true;
                    return sampleQuestConfig;
                }),
            { code: DiscordApiErrors.INVALID_FORM_BODY.code },
        );
        assert.equal(providerCalled, false);

        const missingResponse = await requestJson(createRouteApp(), `/quests/${questId}`);
        assert.equal(missingResponse.status, 404);
        assert.deepEqual(missingResponse.body, {
            code: UNKNOWN_QUEST.code,
            message: UNKNOWN_QUEST.message,
        });

        const invalidResponse = await requestJson(
            createRouteApp(() => sampleQuestConfig),
            "/quests/not-a-snowflake",
        );
        assert.equal(invalidResponse.status, 400);
        assert.equal((invalidResponse.body as { code?: unknown }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
    });

    test("is public for quest IDs without making adjacent quest routes public", async () => {
        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/quests/${questId}`), true);
        assert.equal(isNoAuthorizationRoute("HEAD", `/api/v9/quests/${questId}/`), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/quests/value"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/quests/@me"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/quests/decision?placement=1"), false);
        assert.equal(isNoAuthorizationRoute("POST", `/api/v9/quests/${questId}`), false);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/quests/${questId}/reward-code`), false);

        const response = await requestJson(createAuthenticationBoundaryApp(), `/quests/${questId}`);
        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: UNKNOWN_QUEST.code,
            message: UNKNOWN_QUEST.message,
        });
    });

    test("declares source-backed metadata for the public active-config contract", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "quests", "#quest_id", "index.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Quest Config"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"QuestConfigResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /QuestUserStatusResponse|QuestDecisionResponse|emitEvent|QUESTS_USER_STATUS_UPDATE/);
    });

    test("generates response schema, source catalog, OpenAPI, manifest, contracts, and missing-route metadata", () => {
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; in?: string; required?: boolean }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                source?: string;
                response_schema_refs?: string[];
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
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
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.equal(schemas.QuestConfigResponse.type, "object");
        for (const field of ["id", "config_version", "starts_at", "expires_at", "features", "application", "assets", "colors", "messages", "task_config", "rewards_config"]) {
            assert.equal(schemas.QuestConfigResponse.required?.includes(field), true);
        }
        assert.equal(schemas.QuestConfigResponse.properties?.task_config?.$ref, "#/definitions/QuestTaskConfigResponse");
        assert.equal(schemas.QuestConfigResponse.properties?.rewards_config?.$ref, "#/definitions/QuestRewardsConfigResponse");

        const route = openapi.paths?.["/quests/{quest_id}/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/QuestConfigResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.security, undefined);
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "quest_id" && parameter.in === "path" && parameter.required === true),
            true,
        );

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/quests/{quest_id}");
        assert.equal(sourceEntry?.route_name, "GET_QUESTS_QUEST_ID");
        assert.equal(sourceEntry?.source, "src/api/routes/quests/#quest_id/index.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "QuestConfigResponse"]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/quests/#quest_id/index.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "QuestConfigResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 404],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "public");
        assert.equal(contract?.path, "/quests/:quest_id/");
        assert.equal(contract?.routeMetadata?.responses?.includes("QuestConfigResponse"), true);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 404],
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/quests/{param}" && entry.route_name === "GET_QUESTS_QUEST_ID"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.route === "/quests/{param}/reward-code"),
            true,
        );
    });
});

const sampleQuestConfig: QuestConfigResponse = {
    id: questId,
    config_version: 2,
    starts_at: "2026-01-01T00:00:00.000Z",
    expires_at: "2099-01-01T00:00:00.000Z",
    features: [1, 2],
    application: {
        id: "100000000000000001",
        name: "Spacebar Quest",
        link: "https://example.invalid/spacebar-quest",
    },
    assets: {
        hero: "hero.png",
        hero_video: null,
        quest_bar_hero: "quest-bar-hero.png",
        quest_bar_hero_video: null,
        game_tile: "game-tile.png",
        logotype: "logotype.png",
    },
    colors: {
        primary: "#5865f2",
        secondary: "#57f287",
    },
    messages: {
        quest_name: "Spacebar Quest",
        game_title: "Spacebar",
        game_publisher: "Spacebar Contributors",
    },
    task_config: {
        type: 1,
        join_operator: "and",
        tasks: {
            PLAY_ON_DESKTOP: {
                event_name: "PLAY_ON_DESKTOP",
                target: 900,
                external_ids: ["external-game-id"],
                title: "Play Spacebar",
                description: "Play Spacebar on desktop.",
            },
        },
        enrollment_url: "https://example.invalid/enroll",
        developer_application_id: "100000000000000001",
    },
    rewards_config: {
        assignment_method: 1,
        rewards: [
            {
                type: 3,
                sku_id: "200000000000000001",
                asset: "reward.png",
                asset_video: null,
                messages: {
                    name: "Reward",
                    name_with_article: "a Reward",
                    redemption_instructions_by_platform: {
                        "0": "Redeem in app.",
                    },
                },
                approximate_count: null,
                redemption_link: null,
                expires_at: null,
                expires_at_premium: null,
                expiration_mode: 1,
                orb_quantity: 10,
                quantity: 1,
            },
        ],
        rewards_expire_at: null,
        platforms: [0],
    },
};

function createRouteApp(provider: QuestConfigProvider = getConfiguredQuestConfig) {
    const app = express();

    app.use("/quests/:quest_id", createQuestConfigRouter(provider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticationBoundaryApp() {
    const app = express();

    app.use(Authentication);
    app.use("/quests/:quest_id", questConfigRouter);
    app.use(ErrorHandler);

    return app;
}

function isUnknownQuestError(error: unknown): boolean {
    return (error as { code?: unknown; message?: unknown })?.code === UNKNOWN_QUEST.code && (error as { message?: unknown }).message === UNKNOWN_QUEST.message;
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

async function requestJson(app: express.Express, requestPath: string, init?: RequestInit) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address();
        assert(address && typeof address === "object");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${requestPath}`, init);

        return {
            status: response.status,
            headers: response.headers,
            body: (await response.json()) as unknown,
        };
    } finally {
        await close(server);
    }
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
