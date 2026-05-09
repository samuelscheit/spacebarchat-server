import { describe, test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import type { FindOperator } from "typeorm";

class FakeUser {
    id!: string;
    username!: string;
    bot!: boolean;

    static create(props: Partial<FakeUser>) {
        return Object.assign(new FakeUser(), props);
    }
}

class FakeMember {
    id!: string;
    guild_id!: string;
    user!: FakeUser;

    static create(props: Partial<FakeMember>) {
        return Object.assign(new FakeMember(), props);
    }

    static getRepository(): never {
        throw new Error("test must inject a member repository");
    }
}

class FakeApplication {
    id!: string;
    name!: string;
    icon?: string;
    description!: string;
    summary!: string;
    type?: object;
    hook!: boolean;
    bot_public?: boolean;
    bot_require_code_grant?: boolean;
    verify_key!: string;
    flags!: number;
    redirect_uris!: string[];
    rpc_application_state!: number;
    store_application_state!: number;
    verification_state!: number;
    interactions_endpoint_url?: string;
    integration_public!: boolean;
    integration_require_code_grant!: boolean;
    discoverability_state!: number;
    discovery_eligibility_flags!: number;
    tags?: string[];
    cover_image?: string;
    install_params?: object | null;
    terms_of_service_url?: string;
    privacy_policy_url?: string;
    guild_id?: string;
    custom_install_url?: string;
    bot?: FakeUser;

    static create(props: Partial<FakeApplication>) {
        return Object.assign(new FakeApplication(), props);
    }

    static getRepository(): never {
        throw new Error("test must inject an application repository");
    }
}

type GuildIntegrationsModule = typeof import("./GuildIntegrations");
type ModuleWithLoad = typeof Module & {
    _load(request: string, parent: NodeModule | null, isMain: boolean): unknown;
};

function loadGuildIntegrationsWithFakeUtil(): GuildIntegrationsModule {
    const moduleWithLoad = Module as ModuleWithLoad;
    const originalLoad = moduleWithLoad._load;
    moduleWithLoad._load = function patchedLoad(this: unknown, request: string, parent: NodeModule | null, isMain: boolean) {
        if (request === "@spacebar/util") return { Application: FakeApplication, Member: FakeMember };
        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        delete require.cache[require.resolve("./GuildIntegrations")];
        return require("./GuildIntegrations") as GuildIntegrationsModule;
    } finally {
        moduleWithLoad._load = originalLoad;
    }
}

const { listGuildIntegrations, toGuildIntegration } = loadGuildIntegrationsWithFakeUtil();

function makeBot(id: string, username: string) {
    return FakeUser.create({ id, username, bot: true });
}

function makeApplication(id: string, name: string, bot?: FakeUser) {
    return FakeApplication.create({
        id,
        name,
        description: `${name} description`,
        summary: `${name} summary`,
        hook: true,
        bot_public: true,
        bot_require_code_grant: false,
        verify_key: `verify-${id}`,
        flags: 0,
        redirect_uris: [],
        rpc_application_state: 0,
        store_application_state: 1,
        verification_state: 1,
        integration_public: true,
        integration_require_code_grant: false,
        discoverability_state: 1,
        discovery_eligibility_flags: 2240,
        bot,
    });
}

function botIdsFromApplicationFindOptions(options: unknown): string[] {
    return (((options as { where: { bot: { id: FindOperator<string> } } }).where.bot.id as FindOperator<string>).value ?? []) as unknown as string[];
}

describe("guild integration serialization", () => {
    test("serializes application-backed bot installs without owner or team relations", () => {
        const bot = makeBot("bot-1", "Reminder Bot");
        const application = makeApplication("app-1", "Reminder", bot);
        Object.assign(application, {
            owner: { id: "owner-1" },
            team: { id: "team-1" },
            install_params: null,
        });

        const integration = toGuildIntegration(application as never);

        assert.equal(integration.id, "app-1");
        assert.equal(integration.type, "discord");
        assert.equal(integration.enabled, true);
        assert.deepEqual(integration.account, { id: "bot-1", name: "Reminder Bot" });
        assert.equal(integration.application.id, "app-1");
        assert.equal(integration.application.name, "Reminder");
        assert.equal(integration.application.install_params, undefined);
        assert.equal("owner" in integration.application, false);
        assert.equal("team" in integration.application, false);
    });
});

describe("listGuildIntegrations", () => {
    test("loads bot guild members and returns matching applications in member order", async () => {
        const bots = [makeBot("bot-a", "Alpha Bot"), makeBot("bot-b", "Beta Bot")];
        const members = bots.map((bot) => FakeMember.create({ id: bot.id, guild_id: "guild-1", user: bot }));
        const applications = [makeApplication("app-b", "Beta", bots[1]), makeApplication("app-a", "Alpha", bots[0])];
        const memberFindCalls: unknown[] = [];
        const applicationFindCalls: unknown[] = [];

        const result = await listGuildIntegrations("guild-1", {
            members: {
                find: async (options) => {
                    memberFindCalls.push(options);
                    return members as never;
                },
            },
            applications: {
                find: async (options) => {
                    applicationFindCalls.push(options);
                    const ids = botIdsFromApplicationFindOptions(options);
                    return applications.filter((application) => application.bot && ids.includes(application.bot.id)) as never;
                },
            },
        });

        assert.deepEqual(
            result.map((integration) => integration.id),
            ["app-a", "app-b"],
        );
        assert.deepEqual(memberFindCalls[0], {
            where: { guild_id: "guild-1", user: { bot: true } },
            relations: { user: true },
            select: {
                id: true,
                guild_id: true,
                user: {
                    id: true,
                    username: true,
                    bot: true,
                },
            },
        });
        assert.equal(applicationFindCalls.length, 1);
        assert.deepEqual(botIdsFromApplicationFindOptions(applicationFindCalls[0]), ["bot-a", "bot-b"]);
    });

    test("skips bot members without applications and avoids application query when no bots are installed", async () => {
        const bot = makeBot("bot-without-app", "No App Bot");

        const noAppResult = await listGuildIntegrations("guild-1", {
            members: { find: async () => [FakeMember.create({ id: bot.id, guild_id: "guild-1", user: bot })] as never },
            applications: { find: async () => [] },
        });
        assert.deepEqual(noAppResult, []);

        let applicationFindCalled = false;
        const noBotsResult = await listGuildIntegrations("guild-1", {
            members: { find: async () => [] },
            applications: {
                find: async () => {
                    applicationFindCalled = true;
                    return [];
                },
            },
        });

        assert.deepEqual(noBotsResult, []);
        assert.equal(applicationFindCalled, false);
    });

    test("deduplicates bot member ids before querying applications", async () => {
        const bot = makeBot("bot-1", "Duplicate Bot");
        let queriedBotIds: string[] = [];

        await listGuildIntegrations("guild-1", {
            members: {
                find: async () => [FakeMember.create({ id: bot.id, guild_id: "guild-1", user: bot }), FakeMember.create({ id: bot.id, guild_id: "guild-1", user: bot })] as never,
            },
            applications: {
                find: async (options) => {
                    queriedBotIds = botIdsFromApplicationFindOptions(options);
                    return [makeApplication("app-1", "Duplicate", bot)] as never;
                },
            },
        });

        assert.deepEqual(queriedBotIds, ["bot-1"]);
    });
});
