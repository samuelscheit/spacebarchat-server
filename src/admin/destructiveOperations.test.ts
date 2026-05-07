import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { Channel, Guild, getDatabase, initDatabase } from "@spacebar/util";
import { deleteAdminChannel } from "./mutations";

type DatabaseModule = typeof import("../util/util/Database") & {
    dbConnection: ReturnType<typeof getDatabase> | undefined;
};

const databaseUrl = process.env.ADMIN_DESTRUCTIVE_TEST_DATABASE;
const describeDestructive = databaseUrl ? describe : describe.skip;
const GUILD_TEXT = 0;
const GUILD_CATEGORY = 4;

function databaseModule() {
    return require("../util/util/Database") as DatabaseModule;
}

describeDestructive("admin destructive operation database integration", () => {
    before(async () => {
        process.env.DATABASE = databaseUrl;
        process.env.DB_SYNC = "true";
        process.env.APPLY_DB_MIGRATIONS = "false";
        await initDatabase();
    });

    after(async () => {
        const db = getDatabase();
        if (db?.isInitialized) await db.destroy();
        databaseModule().dbConnection = undefined;
    });

    test("deletes a guild category, detaches children, updates ordering, and emits events", async () => {
        const guildId = "800000000000000001";
        const categoryId = "800000000000000002";
        const childId = "800000000000000003";
        const events: unknown[] = [];

        await Guild.create({
            id: guildId,
            name: "destructive-db-test",
            features: [],
            large: false,
            premium_tier: 0,
            unavailable: false,
            welcome_screen: {
                enabled: false,
                description: "",
                welcome_channels: [],
            },
            widget_enabled: false,
            nsfw: false,
            premium_progress_bar_enabled: false,
            channel_ordering: [categoryId, childId],
            discovery_weight: 0,
            discovery_excluded: false,
        }).save();
        await Channel.create({
            id: categoryId,
            created_at: new Date(),
            name: "category",
            type: GUILD_CATEGORY,
            guild_id: guildId,
            parent_id: null,
            nsfw: false,
            flags: 0,
        }).save();
        await Channel.create({
            id: childId,
            created_at: new Date(),
            name: "child",
            type: GUILD_TEXT,
            guild_id: guildId,
            parent_id: categoryId,
            nsfw: false,
            flags: 0,
        }).save();

        const result = await deleteAdminChannel(categoryId, async (event) => {
            events.push(event);
        });

        const child = await Channel.findOneOrFail({ where: { id: childId } });
        const guild = await Guild.findOneOrFail({ where: { id: guildId }, select: { id: true, channel_ordering: true } });

        assert.equal(await Channel.countBy({ id: categoryId }), 0);
        assert.equal(child.parent_id, null);
        assert.deepEqual(guild.channel_ordering, [childId]);
        assert.deepEqual(result, {
            id: categoryId,
            guildId,
            event: "CHANNEL_DELETE",
            detachedChildChannelIds: [childId],
        });
        assert.deepEqual(
            events.map((event) => ({
                event: (event as { event: string }).event,
                channelId: (event as { channel_id: string }).channel_id,
            })),
            [
                { event: "CHANNEL_UPDATE", channelId: childId },
                { event: "CHANNEL_DELETE", channelId: categoryId },
            ],
        );
    });
});
