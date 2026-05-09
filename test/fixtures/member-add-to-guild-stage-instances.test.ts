import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getMetadataArgsStorage, type EntityManager } from "typeorm";
import { Ban, Channel, Config, Guild, Member, Message, PublicGuildRelations, Role, StageInstance, User } from "@spacebar/util";

type DeferredGuildEvent = {
    event: string;
    data: {
        stage_instances?: unknown[];
        member_count?: number;
        members?: unknown[];
    };
    guild_id?: string;
    user_id?: string;
};

type RepositoryMap = {
    getRepository(entity: unknown): unknown;
};

const guildId = "197038439483310086";
const userId = "80351110224678912";
const stageInstanceResponse = {
    id: "840647391636226060",
    guild_id: guildId,
    channel_id: "733488538393510049",
    topic: "Server Q&A",
    privacy_level: 2,
    discoverable_disabled: false,
    guild_scheduled_event_id: null,
};

function makeReadyGuild(stage_instances: { toPublicStageInstance: () => typeof stageInstanceResponse }[]) {
    return {
        id: guildId,
        unavailable: undefined,
        channels: [],
        emojis: [],
        roles: [
            {
                id: guildId,
                toJSON: () => ({ id: guildId, name: "@everyone", permissions: "0" }),
            },
        ],
        stickers: [],
        threads: [],
        stage_instances,
        voice_states: [],
        large: false,
        member_count: 7,
        premium_subscription_count: 0,
        name: "Stage Test",
        description: null,
        icon: null,
        splash: null,
        banner: null,
        features: [],
        preferred_locale: "en-US",
        owner_id: userId,
        afk_channel_id: null,
        afk_timeout: 300,
        system_channel_id: null,
        verification_level: 0,
        explicit_content_filter: 0,
        default_message_notifications: 0,
        mfa_level: 0,
        premium_tier: 0,
        premium_progress_bar_enabled: false,
        system_channel_flags: 0,
        discovery_splash: null,
        rules_channel_id: null,
        public_updates_channel_id: null,
        max_video_channel_users: 25,
        max_members: 250000,
        nsfw_level: 0,
        nsfw: false,
    };
}

describe("Guild.stage_instances", () => {
    test("is part of the public guild relation graph and is inverse to StageInstance.guild", () => {
        assert.ok(PublicGuildRelations.includes("stage_instances"));

        const relations = getMetadataArgsStorage().relations;
        const guildStageInstancesRelation = relations.find((relation) => relation.target === Guild && relation.propertyName === "stage_instances");
        assert.equal(guildStageInstancesRelation?.relationType, "one-to-many");
        assert.equal(typeof guildStageInstancesRelation?.type, "function");
        assert.equal((guildStageInstancesRelation.type as () => typeof StageInstance)(), StageInstance);

        const stageInstanceGuildRelation = relations.find((relation) => relation.target === StageInstance && relation.propertyName === "guild");
        assert.equal(stageInstanceGuildRelation?.relationType, "many-to-one");
        assert.equal(typeof stageInstanceGuildRelation?.inverseSideProperty, "function");
        assert.equal((stageInstanceGuildRelation.inverseSideProperty as (guild: { stage_instances: string }) => string)({ stage_instances: "stage_instances" }), "stage_instances");
    });
});

describe("Member.addToGuild", () => {
    test("loads public guild stage instances and includes them in the deferred GUILD_CREATE payload", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";

        const publicUser = { id: userId, username: "member", discriminator: "0001", avatar: null, public_flags: 0 };
        const userClass = User as unknown as {
            getPublicUser: (lookupUserId: string, manager?: EntityManager) => Promise<typeof publicUser>;
        };
        const configClass = Config as unknown as { get: () => unknown };
        const roleClass = Role as unknown as { create: (role: object) => object };

        let publicStageInstanceCalls = 0;
        const guild = makeReadyGuild([
            {
                toPublicStageInstance: () => {
                    publicStageInstanceCalls += 1;
                    return stageInstanceResponse;
                },
            },
        ]);
        const deferredEvents: DeferredGuildEvent[] = [];
        const repositoryLookups: unknown[] = [];
        let guildFindOptions: unknown;
        let userLookupManager: EntityManager | undefined;

        t.mock.method(userClass, "getPublicUser", async (_userId: string, manager?: EntityManager) => {
            userLookupManager = manager;
            return publicUser;
        });
        t.mock.method(configClass, "get", () => ({
            limits: { user: { maxGuilds: 100 } },
        }));
        t.mock.method(roleClass, "create", (role: object) => role);

        const guildRepository = {
            findOneOrFail: async (options: unknown) => {
                guildFindOptions = options;
                return guild;
            },
            increment: async () => ({ affected: 1 }),
        };
        const memberRepository = {
            count: async (options: { where?: Record<string, unknown> }) => {
                if (options.where && "id" in options.where && "guild_id" in options.where) return 0;
                if (options.where && "guild_id" in options.where) return 7;
                return 0;
            },
            find: async () => [],
            create: (member: Record<string, unknown>) => ({
                ...member,
                toPublicMember: () => ({
                    user: publicUser,
                    roles: [guildId],
                    joined_at: member.joined_at,
                    nick: null,
                    pending: false,
                }),
            }),
            save: async (member: unknown) => member,
        };
        const banRepository = {
            count: async () => 0,
        };
        const unusedRepository = {
            findOneOrFail: async () => {
                throw new Error("system channel lookup should not run for a guild without a system_channel_id");
            },
            create: () => {
                throw new Error("welcome message creation should not run for a guild without a system_channel_id");
            },
        };
        const manager: RepositoryMap = {
            getRepository(entity: unknown) {
                repositoryLookups.push(entity);
                if (entity === Guild) return guildRepository;
                if (entity === Member) return memberRepository;
                if (entity === Ban) return banRepository;
                if (entity === Channel) return unusedRepository;
                if (entity === Message) return unusedRepository;
                if (entity === StageInstance) throw new Error("stage instances should be loaded through Guild.stage_instances, not a separate repository query");
                throw new Error(`Unexpected repository lookup for ${String(entity)}`);
            },
        };

        await Member.addToGuild(userId, guildId, {
            manager: manager as EntityManager,
            deferredEvents: deferredEvents as never,
        });

        assert.equal(userLookupManager, manager);
        assert.deepEqual(guildFindOptions, {
            where: { id: guildId },
            relations: PublicGuildRelations,
            relationLoadStrategy: "query",
        });
        assert.ok(PublicGuildRelations.includes("stage_instances"));
        assert.ok(!repositoryLookups.includes(StageInstance), "StageInstance repository should not be queried separately");

        const guildCreateEvent = deferredEvents.find((event) => event.event === "GUILD_CREATE");
        assert.ok(guildCreateEvent, "expected a deferred GUILD_CREATE event");
        assert.deepEqual(guildCreateEvent.data.stage_instances, [stageInstanceResponse]);
        assert.equal(guildCreateEvent.data.member_count, 8);
        assert.ok(publicStageInstanceCalls >= 1);
    });
});
