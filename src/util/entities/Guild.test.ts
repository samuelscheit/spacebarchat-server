import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE ??= "postgres://test:test@localhost:5432/test";
process.env.APPLY_DB_MIGRATIONS ??= "false";

const ROLE_PERMISSION_OVERWRITE_TYPE = 0;
const MEMBER_PERMISSION_OVERWRITE_TYPE = 1;
const GUILD_TEXT_CHANNEL_TYPE = 0;
const GUILD_CATEGORY_CHANNEL_TYPE = 4;

type EntityPayload = Record<string, unknown>;
type SaveableEntity = EntityPayload & { save: () => Promise<EntityPayload> };

function createSaveableEntity(payload: EntityPayload): SaveableEntity {
    const entity = {
        ...payload,
        save: async () => entity,
    };

    return entity;
}

test("Guild.createGuild remaps template channel role permission overwrites before channel creation", async (t) => {
    const [{ Guild }, { Role }, { Channel }, { Config, Snowflake }] = await Promise.all([
        import("./Guild.js"),
        import("./Role.js"),
        import("./Channel.js"),
        import("../util/index.js"),
    ]);

    const guildClass = Guild as unknown as {
        create: (guild: EntityPayload) => SaveableEntity;
        insertChannelInOrder: (guildId: string, channelId: string, insertPoint: string | number, guild?: EntityPayload) => Promise<number>;
    };
    const roleClass = Role as unknown as {
        create: (role: EntityPayload) => SaveableEntity;
    };
    const channelClass = Channel as unknown as {
        createChannel: (channel: EntityPayload, userId?: string, options?: EntityPayload) => Promise<EntityPayload>;
    };
    const configClass = Config as unknown as {
        get: () => EntityPayload;
    };
    const snowflakeClass = Snowflake as unknown as {
        generate: () => string;
    };

    const generatedIds = ["new-guild", "new-role", "new-category", "new-text"];
    const createdRoles: EntityPayload[] = [];
    const createdChannels: EntityPayload[] = [];

    t.mock.method(configClass, "get", () => ({
        defaults: {
            guild: {
                afkTimeout: 300,
                defaultMessageNotifications: 0,
                explicitContentFilter: 0,
                maxPresences: null,
                maxVideoChannelUsers: 25,
            },
        },
        guild: {
            defaultFeatures: [],
        },
        limits: {
            guild: {
                maxMembers: 250000,
            },
        },
        regions: {
            default: "deprecated",
        },
    }));
    t.mock.method(snowflakeClass, "generate", () => {
        const id = generatedIds.shift();
        assert.ok(id);
        return id;
    });
    t.mock.method(guildClass, "create", (guild: EntityPayload) =>
        createSaveableEntity({
            ...guild,
            channel_ordering: [],
        }),
    );
    t.mock.method(roleClass, "create", (role: EntityPayload) => {
        createdRoles.push(role);
        return createSaveableEntity(role);
    });
    t.mock.method(channelClass, "createChannel", async (channel: EntityPayload) => {
        createdChannels.push(channel);
        return channel;
    });
    t.mock.method(guildClass, "insertChannelInOrder", async () => 0);

    const guild = await Guild.createGuild({
        name: "Template Import",
        owner_id: "owner",
        roles: [{ id: "old-role", name: "Mods" }],
        channels: [
            {
                id: "old-category",
                type: GUILD_CATEGORY_CHANNEL_TYPE,
                name: "Private",
                permission_overwrites: [
                    { id: "source-guild", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "0", deny: "1024" },
                    { id: "old-role", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "1024", deny: "0" },
                    { id: "member-id", type: MEMBER_PERMISSION_OVERWRITE_TYPE, allow: "2048", deny: "0" },
                    { id: "missing-role", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "4096", deny: "0" },
                ],
            },
            {
                id: "old-text",
                parent_id: "old-category",
                type: GUILD_TEXT_CHANNEL_TYPE,
                name: "mods",
                permission_overwrites: [{ id: "old-role", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "2048", deny: "0" }],
            },
        ],
        source_guild_id: "source-guild",
    });

    assert.equal(guild.id, "new-guild");
    assert.deepEqual(
        createdRoles.map((role) => role.id),
        ["new-guild", "new-role"],
    );
    assert.deepEqual(createdChannels[0].permission_overwrites, [
        { id: "new-guild", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "0", deny: "1024" },
        { id: "new-role", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "1024", deny: "0" },
    ]);
    assert.equal(createdChannels[1].parent_id, "new-category");
    assert.deepEqual(createdChannels[1].permission_overwrites, [{ id: "new-role", type: ROLE_PERMISSION_OVERWRITE_TYPE, allow: "2048", deny: "0" }]);
});
