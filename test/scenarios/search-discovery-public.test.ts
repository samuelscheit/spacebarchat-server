import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Categories, closeDatabase, Config, generateToken, GuildFeature, initDatabase, User } from "@spacebar/util";
import { assertJsonError, assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { makeGuild } from "../fixtures/entities";
import { startApi } from "../server/startApi";

type StartedApi = Awaited<ReturnType<typeof startApi>>;

const coveredManifestIds = [
    "api:http:GET:/apex/experiments/",
    "api:http:GET:/discovery/categories",
    "api:http:GET:/discoverable-guilds/",
    "api:http:GET:/experiments/",
    "api:http:GET:/gateway/",
    "api:http:GET:/gateway/bot/",
    "api:http:GET:/gifs/search/",
    "api:http:GET:/gifs/trending-gifs/",
    "api:http:GET:/gifs/trending/",
    "api:http:GET:/guild-recommendations/",
    "api:http:GET:/policies/instance/",
    "api:http:GET:/policies/instance/config/",
    "api:http:GET:/policies/instance/domains/",
    "api:http:GET:/policies/instance/limits/",
    "api:http:GET:/policies/stats/",
    "api:http:GET:/scheduled-maintenances/upcoming.json/",
];
const observedManifestIds = new Set<string>();
const manifestIdByRoutePath = new Map(
    coveredManifestIds.map((id) => {
        const routePath = id.slice("api:http:GET:".length);
        return [stripOptionalTrailingSlash(routePath), id] as const;
    }),
);

test(
    "search, discovery, public policy, and gateway discovery routes expose configured state without external services",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:GET:/apex/experiments/",
            "api:http:GET:/discovery/categories",
            "api:http:GET:/discoverable-guilds/",
            "api:http:GET:/experiments/",
            "api:http:GET:/gateway/",
            "api:http:GET:/gateway/bot/",
            "api:http:GET:/gifs/search/",
            "api:http:GET:/gifs/trending-gifs/",
            "api:http:GET:/gifs/trending/",
            "api:http:GET:/guild-recommendations/",
            "api:http:GET:/policies/instance/",
            "api:http:GET:/policies/instance/config/",
            "api:http:GET:/policies/instance/domains/",
            "api:http:GET:/policies/instance/limits/",
            "api:http:GET:/policies/stats/",
            "api:http:GET:/scheduled-maintenances/upcoming.json/",
        ]);
        observedManifestIds.clear();

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_search_discovery_public" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-search-discovery-public-"));
        const previous = snapshotProcessState();
        let api: StartedApi | undefined;

        try {
            process.chdir(tempCwd);
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            process.env.LOG_ROUTES = "false";
            process.env.CONFIG_PATH = path.join(tempCwd, "config.json");
            process.env.CONFIG_READONLY = "true";
            delete process.env.DB_SYNC;
            await writeFile(
                process.env.CONFIG_PATH,
                JSON.stringify({
                    general: {
                        serverName: "scenario-public",
                        instanceName: "Scenario Public Instance",
                        instanceDescription: "Scenario public route coverage",
                        frontPage: "https://front.example",
                    },
                    api: { endpointPublic: "https://api.example/api/v9" },
                    cdn: { endpointPublic: "https://cdn.example", endpointPrivate: "http://127.0.0.1:3003" },
                    gateway: { endpointPublic: "ws://gateway.example" },
                    gif: { enabled: true, provider: "tenor", apiKey: "scenario-tenor-key" },
                    guild: {
                        discovery: {
                            showAllGuilds: false,
                            limit: 10,
                            offset: 0,
                            hideJoinedGuilds: false,
                        },
                        autoJoin: {
                            enabled: false,
                            guilds: [],
                            canLeave: true,
                            bots: false,
                        },
                    },
                    security: { statsWorldReadable: true },
                }),
            );
            await Config.init(true);
            await initDatabase();
            api = await startApi();

            const suffix = `${process.pid}${Date.now()}`;
            const owner = await registerUser(`publicowner${suffix.slice(-8)}`, `public-owner-${suffix}@example.com`);
            const normal = await registerUser(`publicnormal${suffix.slice(-8)}`, `public-normal-${suffix}@example.com`);
            await User.update({ id: owner.id }, { rights: "1" });
            await User.update({ id: normal.id }, { rights: "0" });
            const ownerToken = await generateToken(owner.id);
            const normalToken = await generateToken(normal.id);
            assert.ok(ownerToken, "owner token generation should return a bearer token");
            assert.ok(normalToken, "normal token generation should return a bearer token");

            await seedDiscoveryData(owner);

            await coverExperimentRoutes(api, ownerToken);
            await coverGatewayDiscovery(api, ownerToken);
            await coverPolicyRoutes(api, ownerToken, normalToken);
            await coverDiscoveryRoutes(api, ownerToken);
            await coverScheduledMaintenance(api);

            const tenorFetch = installTenorFetchMock();
            try {
                await coverGifRoutes(api, ownerToken, tenorFetch.requests);
            } finally {
                tenorFetch.restore();
            }

            assert.deepEqual([...observedManifestIds].sort(), [...coveredManifestIds].sort());
        } finally {
            if (api) await api.stop();
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

async function coverExperimentRoutes(api: StartedApi, token: string) {
    const firstExperiments = await getJson(`${api.apiBaseUrl}/experiments`);
    await assertStatus(firstExperiments, 200);
    const firstExperimentsBody = await assertJsonObject(firstExperiments);
    assert.deepEqual(firstExperimentsBody.assignments, []);
    assert.deepEqual(firstExperimentsBody.guild_experiments, []);
    assert.equal(typeof firstExperimentsBody.fingerprint, "string");

    const repeatedExperiments = await getJson(`${api.apiBaseUrl}/experiments`, undefined, { "x-fingerprint": firstExperimentsBody.fingerprint as string });
    await assertStatus(repeatedExperiments, 200);
    const repeatedExperimentsBody = await assertJsonObject(repeatedExperiments);
    assert.equal("fingerprint" in repeatedExperimentsBody, false);

    const authenticatedExperiments = await getJson(`${api.apiBaseUrl}/experiments`, token);
    await assertStatus(authenticatedExperiments, 200);
    const authenticatedExperimentsBody = await assertJsonObject(authenticatedExperiments);
    assert.equal("fingerprint" in authenticatedExperimentsBody, false);

    const invalidOptionalAuthExperiments = await getJson(`${api.apiBaseUrl}/experiments`, "invalid-public-token");
    await assertStatus(invalidOptionalAuthExperiments, 200);

    const apex = await getJson(`${api.apiBaseUrl}/apex/experiments`);
    await assertStatus(apex, 200);
    const apexBody = await assertJsonObject(apex);
    assert.deepEqual(apexBody.assignments, {});
    assert.equal(typeof apexBody.installation, "string");

    const repeatedApex = await getJson(`${api.apiBaseUrl}/apex/experiments`, undefined, { "x-installation-id": apexBody.installation as string });
    await assertStatus(repeatedApex, 200);
    const repeatedApexBody = await assertJsonObject(repeatedApex);
    assert.deepEqual(repeatedApexBody.assignments, {});
    assert.equal("installation" in repeatedApexBody, false);
}

async function coverGatewayDiscovery(api: StartedApi, token: string) {
    const gateway = await getJson(`${api.apiBaseUrl}/gateway`);
    await assertStatus(gateway, 200);
    assert.deepEqual(await assertJsonObject(gateway), { url: "ws://gateway.example" });

    await assertJsonError(await getJson(`${api.apiBaseUrl}/gateway/bot`), 401);

    const gatewayBot = await getJson(`${api.apiBaseUrl}/gateway/bot`, token);
    await assertStatus(gatewayBot, 200);
    const gatewayBotBody = await assertJsonObject(gatewayBot);
    assert.equal(gatewayBotBody.url, "ws://gateway.example");
    assert.equal(gatewayBotBody.shards, 1);
    assert.deepEqual(gatewayBotBody.session_start_limit, {
        total: 1000,
        remaining: 999,
        reset_after: 14400000,
        max_concurrency: 1,
    });
}

async function coverPolicyRoutes(api: StartedApi, ownerToken: string, normalToken: string) {
    const instance = await getJson(`${api.apiBaseUrl}/policies/instance/`);
    await assertStatus(instance, 200);
    const instanceBody = await assertJsonObject(instance);
    assert.equal(instanceBody.serverName, "scenario-public");
    assert.equal(instanceBody.instanceName, "Scenario Public Instance");

    const domains = await getJson(`${api.apiBaseUrl}/policies/instance/domains`);
    await assertStatus(domains, 200);
    const domainsBody = await assertJsonObject(domains);
    assert.equal(domainsBody.apiEndpoint, "https://api.example/api/v9");
    assert.equal(domainsBody.cdn, "https://cdn.example");
    assert.equal(domainsBody.gateway, "ws://gateway.example");

    const limits = await getJson(`${api.apiBaseUrl}/policies/instance/limits`);
    await assertStatus(limits, 200);
    const limitsBody = await assertJsonObject(limits);
    assert.equal(typeof (limitsBody.user as Record<string, unknown>).maxGuilds, "number");

    const anonymousConfig = await getJson(`${api.apiBaseUrl}/policies/instance/config`);
    await assertStatus(anonymousConfig, 200);
    const anonymousConfigBody = await assertJsonObject(anonymousConfig);
    assert.equal(typeof anonymousConfigBody.limits_user_maxGuilds, "number");
    assert.equal("security" in anonymousConfigBody, false);

    const operatorConfig = await getJson(`${api.apiBaseUrl}/policies/instance/config`, ownerToken);
    await assertStatus(operatorConfig, 200);
    const operatorConfigBody = await assertJsonObject(operatorConfig);
    assert.equal((operatorConfigBody.security as Record<string, unknown>).statsWorldReadable, true);
    assert.equal((operatorConfigBody.gif as Record<string, unknown>).apiKey, "scenario-tenor-key");

    Config.get().security.statsWorldReadable = true;
    const publicStats = await getJson(`${api.apiBaseUrl}/policies/stats`);
    await assertStatus(publicStats, 200);
    const publicStatsBody = await assertJsonObject(publicStats);
    assert.ok(((publicStatsBody.counts as Record<string, number>).user ?? 0) >= 2);

    Config.get().security.statsWorldReadable = false;
    await assertJsonError(await getJson(`${api.apiBaseUrl}/policies/stats`), 401);
    await assertJsonError(await getJson(`${api.apiBaseUrl}/policies/stats`, normalToken), 403);

    const operatorStats = await getJson(`${api.apiBaseUrl}/policies/stats`, ownerToken);
    await assertStatus(operatorStats, 200);
    const operatorStatsBody = await assertJsonObject(operatorStats);
    assert.ok(((operatorStatsBody.counts as Record<string, number>).guild ?? 0) >= 1);
}

async function coverDiscoveryRoutes(api: StartedApi, token: string) {
    await assertJsonError(await getJson(`${api.apiBaseUrl}/discovery/categories`), 401);
    const categories = await getJsonArray(`${api.apiBaseUrl}/discovery/categories`, token);
    assert.deepEqual(
        categories.map((category) => category.id),
        [1, 2],
    );

    const primaryCategories = await getJsonArray(`${api.apiBaseUrl}/discovery/categories?primary_only=true`, token);
    assert.deepEqual(
        primaryCategories.map((category) => category.id),
        [1],
    );

    await assertJsonError(await getJson(`${api.apiBaseUrl}/discoverable-guilds?categories=1&limit=5`), 401);
    const discoverable = await getJson(`${api.apiBaseUrl}/discoverable-guilds?categories=1&limit=5`, token);
    await assertStatus(discoverable, 200);
    const discoverableBody = await assertJsonObject(discoverable);
    assert.equal(discoverableBody.total, 1);
    assert.equal(discoverableBody.offset, 0);
    assert.equal(discoverableBody.limit, 5);
    const guilds = discoverableBody.guilds as Array<Record<string, unknown>>;
    assert.equal(guilds.length, 1);
    assert.equal(guilds[0].name, "Discoverable Scenario");
    assert.equal("discovery_weight" in guilds[0], false);
    assert.equal("discovery_splash" in guilds[0], false);

    await assertJsonError(await getJson(`${api.apiBaseUrl}/guild-recommendations?limit=5`), 401);
    assert.equal(Config.get().guild.discovery.useRecommendation, false);
    const disabledRecommendations = await getJson(`${api.apiBaseUrl}/guild-recommendations?limit=5`, token);
    const disabledRecommendationsBody = await assertJsonError(disabledRecommendations, 404);
    assert.match(disabledRecommendationsBody.message as string, /Guild recommendations are disabled/);

    Config.get().guild.discovery.useRecommendation = true;
    const recommendations = await getJson(`${api.apiBaseUrl}/guild-recommendations?limit=5`, token);
    await assertStatus(recommendations, 200);
    const recommendationsBody = await assertJsonObject(recommendations);
    assert.match(recommendationsBody.load_id as string, /^server_recs\/[0-9a-f]{32}$/);
    assert.ok((recommendationsBody.recommended_guilds as Array<Record<string, unknown>>).some((guild) => guild.name === "Discoverable Scenario"));
}

async function coverScheduledMaintenance(api: StartedApi) {
    const maintenance = await getJson(`${api.apiBaseUrl}/scheduled-maintenances/upcoming.json`);
    await assertStatus(maintenance, 200);
    assert.deepEqual(await assertJsonObject(maintenance), {
        page: {},
        scheduled_maintenances: {},
    });
}

async function coverGifRoutes(api: StartedApi, token: string, tenorRequests: string[]) {
    await assertJsonError(await getJson(`${api.apiBaseUrl}/gifs/search?q=spacebar&media_format=mp4&locale=en_US`), 401);
    const search = await getJsonArray(`${api.apiBaseUrl}/gifs/search?q=spacebar&media_format=mp4&locale=en_US`, token);
    assert.deepEqual(search, [expectedGifResult()]);

    await assertJsonError(await getJson(`${api.apiBaseUrl}/gifs/trending-gifs?media_format=mp4&locale=en_US`), 401);
    const trendingGifs = await getJsonArray(`${api.apiBaseUrl}/gifs/trending-gifs?media_format=mp4&locale=en_US`, token);
    assert.deepEqual(trendingGifs, [expectedGifResult()]);

    await assertJsonError(await getJson(`${api.apiBaseUrl}/gifs/trending?locale=en_US`), 401);
    const trending = await getJson(`${api.apiBaseUrl}/gifs/trending?locale=en_US`, token);
    await assertStatus(trending, 200);
    const trendingBody = await assertJsonObject(trending);
    assert.deepEqual(trendingBody.categories, [{ name: "spacebar", src: "https://tenor.example/category.png" }]);
    assert.deepEqual(trendingBody.gifs, [expectedGifResult()]);

    assert.ok(tenorRequests.some((url) => url.includes("/v1/search?") && url.includes("q=spacebar")));
    assert.ok(tenorRequests.filter((url) => url.includes("/v1/trending?")).length >= 2);
    assert.ok(tenorRequests.some((url) => url.includes("/v1/categories?")));
}

async function seedDiscoveryData(owner: User) {
    await Categories.create({ id: 1, name: "Gaming", is_primary: true, icon: "controller", localizations: {} }).save();
    await Categories.create({ id: 2, name: "Music", is_primary: false, icon: "music", localizations: {} }).save();

    await makeGuild(owner, {
        id: "100000000000002001",
        name: "Discoverable Scenario",
        features: [GuildFeature.Discoverable],
        primary_category_id: 1,
        member_count: 42,
        discovery_weight: 100,
        discovery_splash: "should-not-serialize",
        discovery_excluded: false,
    }).save();

    await makeGuild(owner, {
        id: "100000000000002002",
        name: "Excluded Scenario",
        features: [GuildFeature.Discoverable],
        primary_category_id: 1,
        member_count: 99,
        discovery_weight: 200,
        discovery_excluded: true,
    }).save();

    await makeGuild(owner, {
        id: "100000000000002003",
        name: "Private Scenario",
        features: [],
        primary_category_id: 1,
        member_count: 7,
        discovery_weight: 300,
        discovery_excluded: false,
    }).save();
}

function installTenorFetchMock() {
    const originalFetch = globalThis.fetch;
    const requests: string[] = [];

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (!url.startsWith("https://g.tenor.com/")) return await originalFetch(input, init);

        requests.push(url);
        if (url.includes("/v1/categories")) {
            return jsonResponse({
                tags: [{ searchterm: "spacebar", image: "https://tenor.example/category.png" }],
            });
        }

        return jsonResponse({ results: [tenorGif()] });
    }) satisfies typeof fetch;

    return {
        requests,
        restore: () => {
            globalThis.fetch = originalFetch;
        },
    };
}

function jsonResponse(body: unknown) {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
}

function tenorGif() {
    return {
        id: "scenario-gif",
        title: "Scenario GIF",
        itemurl: "https://tenor.example/item",
        media: [
            {
                mp4: {
                    url: "https://tenor.example/media.mp4",
                    dims: [320, 180],
                    preview: "https://tenor.example/preview.png",
                },
                gif: {
                    url: "https://tenor.example/media.gif",
                },
            },
        ],
    };
}

function expectedGifResult() {
    return {
        id: "scenario-gif",
        title: "Scenario GIF",
        url: "https://tenor.example/item",
        src: "https://tenor.example/media.mp4",
        gif_src: "https://tenor.example/media.gif",
        width: 320,
        height: 180,
        preview: "https://tenor.example/preview.png",
    };
}

async function registerUser(username: string, email: string) {
    return await User.register({
        username,
        email,
        password: "not-a-real-login-hash",
    });
}

async function getJson(url: string, token?: string, headers: Record<string, string> = {}) {
    observeManifestRoute(url);
    return await fetch(url, {
        headers: {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...headers,
        },
    });
}

async function getJsonArray(url: string, token?: string) {
    const response = await getJson(url, token);
    await assertStatus(response, 200);
    const body = await response.json();
    assert.ok(Array.isArray(body));
    return body as Array<Record<string, unknown>>;
}

function observeManifestRoute(url: string) {
    const pathname = new URL(url).pathname.replace(/^\/api(?:\/v\d+)?/, "");
    const id = manifestIdByRoutePath.get(stripOptionalTrailingSlash(pathname));
    if (id) observedManifestIds.add(id);
}

function stripOptionalTrailingSlash(value: string) {
    if (value.length <= 1) return value;
    return value.endsWith("/") ? value.slice(0, -1) : value;
}

function snapshotProcessState() {
    return {
        cwd: process.cwd(),
        DATABASE: process.env.DATABASE,
        APPLY_DB_MIGRATIONS: process.env.APPLY_DB_MIGRATIONS,
        CONFIG_PATH: process.env.CONFIG_PATH,
        CONFIG_READONLY: process.env.CONFIG_READONLY,
        DB_SYNC: process.env.DB_SYNC,
        LOG_ROUTES: process.env.LOG_ROUTES,
    };
}

function restoreProcessState(state: ReturnType<typeof snapshotProcessState>) {
    process.chdir(state.cwd);
    restoreEnv("DATABASE", state.DATABASE);
    restoreEnv("APPLY_DB_MIGRATIONS", state.APPLY_DB_MIGRATIONS);
    restoreEnv("CONFIG_PATH", state.CONFIG_PATH);
    restoreEnv("CONFIG_READONLY", state.CONFIG_READONLY);
    restoreEnv("DB_SYNC", state.DB_SYNC);
    restoreEnv("LOG_ROUTES", state.LOG_ROUTES);
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}
