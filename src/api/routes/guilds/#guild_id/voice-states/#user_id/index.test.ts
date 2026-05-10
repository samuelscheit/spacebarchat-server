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
import { DiscordApiErrors } from "@spacebar/util";
import { HTTPError } from "lambert-server";
import type { UserVoiceStateDependencies, VoiceStateGetRecord } from "./index";

const requireModule = require;
const routeModulePath = require.resolve("./index");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /guilds/:guild_id/voice-states/:user_id", () => {
    test("declares authenticated user voice-state metadata", (t) => {
        const routeOptions = captureRouteOptions(t);

        assert.deepEqual(routeOptions[0], {
            summary: "Get User Voice State",
            responses: {
                200: {
                    body: "VoiceStateResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("rejects non-bot user tokens before guild or voice-state lookups", async () => {
        const { getUserVoiceState } = loadRouteModule();
        const harness = createDependencies();

        await assert.rejects(
            () => getUserVoiceState("viewer", false, "guild", "target", harness.dependencies),
            (error) => error === DiscordApiErrors.BOT_ONLY_ENDPOINT,
        );

        assert.deepEqual(harness.calls, {
            guildExists: [],
            assertRequesterGuildMember: [],
            findVoiceState: [],
            targetMemberExists: [],
            canViewVoiceChannel: [],
        });
    });

    test("requires a real guild and requester guild membership before voice-state lookup", async () => {
        const { getUserVoiceState } = loadRouteModule();
        const missingGuild = createDependencies({ guildExists: false });

        await assert.rejects(
            () => getUserVoiceState("viewer", true, "missing-guild", "target", missingGuild.dependencies),
            (error) => error === DiscordApiErrors.UNKNOWN_GUILD,
        );
        assert.deepEqual(missingGuild.calls.findVoiceState, []);

        const outsider = createDependencies({ requesterMember: false });
        await assert.rejects(
            () => getUserVoiceState("outsider", true, "guild", "target", outsider.dependencies),
            (error: unknown) => error instanceof Error && error.message === "You are not member of this guild",
        );
        assert.deepEqual(outsider.calls.findVoiceState, []);
    });

    test("returns only the persisted public voice-state response for a visible channel", async () => {
        const { getUserVoiceState } = loadRouteModule();
        const timestamp = new Date("2026-05-11T10:20:30.000Z");
        const harness = createDependencies({
            voiceState: createVoiceState({
                self_stream: true,
                request_to_speak_timestamp: timestamp,
            }),
        });

        const response = await getUserVoiceState("bot-user", true, "guild", "target", harness.dependencies);

        assert.deepEqual(response, {
            guild_id: "guild",
            channel_id: "voice",
            user_id: "target",
            session_id: "session",
            deaf: false,
            mute: false,
            self_deaf: false,
            self_mute: false,
            self_stream: true,
            self_video: false,
            suppress: false,
            request_to_speak_timestamp: "2026-05-11T10:20:30.000Z",
        });
        assert.deepEqual(harness.calls, {
            guildExists: ["guild"],
            assertRequesterGuildMember: [{ userId: "bot-user", guildId: "guild" }],
            findVoiceState: [{ guildId: "guild", userId: "target" }],
            targetMemberExists: [{ guildId: "guild", userId: "target" }],
            canViewVoiceChannel: [{ userId: "bot-user", guildId: "guild", channelId: "voice" }],
        });
    });

    test("uses source-backed voice-state errors for missing state, stale target membership, and hidden channels", async () => {
        const { getUserVoiceState } = loadRouteModule();

        const missingState = createDependencies({ voiceState: null });
        await assert.rejects(
            () => getUserVoiceState("bot-user", true, "guild", "target", missingState.dependencies),
            (error) => error === DiscordApiErrors.UNKNOWN_VOICE_STATE,
        );
        assert.deepEqual(missingState.calls.targetMemberExists, []);

        const staleMember = createDependencies({ targetMember: false });
        await assert.rejects(
            () => getUserVoiceState("bot-user", true, "guild", "target", staleMember.dependencies),
            (error) => error === DiscordApiErrors.UNKNOWN_MEMBER,
        );
        assert.deepEqual(staleMember.calls.canViewVoiceChannel, []);

        const hiddenChannel = createDependencies({ canViewChannel: false });
        await assert.rejects(
            () => getUserVoiceState("bot-user", true, "guild", "target", hiddenChannel.dependencies),
            (error) => error === DiscordApiErrors.MISSING_ACCESS,
        );
    });

    test("generated artifacts own only the exact source-backed GET user voice-state path", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "voice-states", "#user_id", "index.ts"), "utf8");
        const schemas = readJson<Record<string, { properties?: Record<string, { type?: unknown; format?: string }>; required?: string[] }>>(path.join("assets", "schemas.json"));
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

        assert.match(routeSource, /router\.get\(\s*["']\/["']/);
        assert.match(routeSource, /body:\s*"VoiceStateResponse"/);
        assert.match(routeSource, /401:\s*{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.VoiceStateResponse?.properties?.guild_id?.type, "string");
        assert.equal(schemas.VoiceStateResponse?.properties?.channel_id?.type, "string");
        assert.equal(schemas.VoiceStateResponse?.properties?.user_id?.type, "string");
        assert.deepEqual(schemas.VoiceStateResponse?.properties?.request_to_speak_timestamp?.type, ["null", "string"]);
        assert.ok(schemas.VoiceStateResponse?.required?.includes("session_id"));

        const openapiRoute = openapi.paths?.["/guilds/{guild_id}/voice-states/{user_id}/"]?.get;
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/VoiceStateResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/voice-states/{user_id}");
        assert.equal(sourceRoute?.route_name, "GET_GUILDS_GUILD_ID_VOICE_STATES_USER_ID");
        assert.equal(sourceRoute?.source, "src/api/routes/guilds/#guild_id/voice-states/#user_id/index.ts");
        assert.equal(sourceRoute?.response_schema_refs?.includes("VoiceStateResponse"), true);
        assert.equal(sourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/voice-states/{param}"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/voice-states/@me"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PATCH" && entry.route === "/guilds/{param}/voice-states/@me"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/guilds/:guild_id/voice-states/:user_id/");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/voice-states/#user_id/index.ts");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("VoiceStateResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(400), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(403), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(404), true);
    });
});

function loadRouteModule(): typeof import("./index") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./index");
}

function captureRouteOptions(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: unknown, _res: unknown, next: () => void) => next();
    });

    loadRouteModule();

    return routeOptions;
}

type DependencyCalls = {
    guildExists: string[];
    assertRequesterGuildMember: { userId: string; guildId: string }[];
    findVoiceState: { guildId: string; userId: string }[];
    targetMemberExists: { guildId: string; userId: string }[];
    canViewVoiceChannel: { userId: string; guildId: string; channelId: string }[];
};

type DependencyOptions = {
    guildExists?: boolean;
    requesterMember?: boolean;
    voiceState?: VoiceStateGetRecord | null;
    targetMember?: boolean;
    canViewChannel?: boolean;
};

function createDependencies(options: DependencyOptions = {}) {
    const calls: DependencyCalls = {
        guildExists: [],
        assertRequesterGuildMember: [],
        findVoiceState: [],
        targetMemberExists: [],
        canViewVoiceChannel: [],
    };

    const dependencies: UserVoiceStateDependencies = {
        guildExists: async (guildId) => {
            calls.guildExists.push(guildId);
            return options.guildExists ?? true;
        },
        assertRequesterGuildMember: async (userId, guildId) => {
            calls.assertRequesterGuildMember.push({ userId, guildId });
            if (options.requesterMember === false) throw new HTTPError("You are not member of this guild", 403);
        },
        findVoiceState: async (guildId, userId) => {
            calls.findVoiceState.push({ guildId, userId });
            return options.voiceState === undefined ? createVoiceState() : options.voiceState;
        },
        targetMemberExists: async (guildId, userId) => {
            calls.targetMemberExists.push({ guildId, userId });
            return options.targetMember ?? true;
        },
        canViewVoiceChannel: async (userId, guildId, channelId) => {
            calls.canViewVoiceChannel.push({ userId, guildId, channelId });
            return options.canViewChannel ?? true;
        },
    };

    return { calls, dependencies };
}

function createVoiceState(overrides: Partial<ReturnType<VoiceStateGetRecord["toPublicVoiceState"]>> = {}): VoiceStateGetRecord {
    const publicVoiceState = {
        guild_id: "guild",
        channel_id: "voice",
        user_id: "target",
        session_id: "session",
        deaf: false,
        mute: false,
        self_deaf: false,
        self_mute: false,
        self_video: false,
        suppress: false,
        request_to_speak_timestamp: null,
        ...overrides,
    };

    return {
        guild_id: publicVoiceState.guild_id,
        channel_id: publicVoiceState.channel_id,
        user_id: publicVoiceState.user_id,
        toPublicVoiceState: () => publicVoiceState,
    };
}

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), filePath), "utf8")) as T;
}
