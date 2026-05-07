import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
    getGuildChannelOrdering,
    getGuildChannelOrderingColumnOptions,
    getGuildChannelPosition,
    insertInGuildChannelOrdering,
    mapTemplateChannelOrdering,
    sortChannelsByChannelOrdering,
    sortTemplateChannelsForCreation,
} from "./GuildChannelOrdering";

describe("getGuildChannelOrderingColumnOptions", () => {
    test("uses native Postgres arrays with a driver-normalised default", () => {
        assert.deepEqual(getGuildChannelOrderingColumnOptions("postgres"), {
            select: false,
            type: "int8",
            array: true,
            default: [],
        });
    });

    test("uses simple arrays for SQLite compatibility", () => {
        assert.deepEqual(getGuildChannelOrderingColumnOptions("sqlite"), {
            select: false,
            type: "simple-array",
            default: "",
        });

        assert.deepEqual(getGuildChannelOrderingColumnOptions("better-sqlite3"), {
            select: false,
            type: "simple-array",
            default: "",
        });
    });
});

describe("getGuildChannelOrdering", () => {
    test("returns existing channel ordering arrays", () => {
        const ordering = ["1", "2"];
        const guild = { channel_ordering: ordering };

        assert.equal(getGuildChannelOrdering(guild), ordering);
        assert.deepEqual(guild.channel_ordering, ["1", "2"]);
    });

    test("initialises undefined channel ordering", () => {
        const guild: { channel_ordering?: string[] } = {};

        const ordering = getGuildChannelOrdering(guild);

        assert.deepEqual(ordering, []);
        assert.equal(guild.channel_ordering, ordering);
    });

    test("repairs null channel ordering from legacy rows", () => {
        const guild = { channel_ordering: null };

        const ordering = getGuildChannelOrdering(guild);

        assert.deepEqual(ordering, []);
        assert.equal(guild.channel_ordering, ordering);
    });
});

describe("getGuildChannelPosition", () => {
    test("returns positions from existing ordering arrays", () => {
        const guild = { channel_ordering: ["a", "b"] };

        assert.equal(getGuildChannelPosition(guild, "b"), 1);
    });

    test("repairs null ordering before looking up positions", () => {
        const guild = { channel_ordering: null };

        assert.equal(getGuildChannelPosition(guild, "missing"), -1);
        assert.deepEqual(guild.channel_ordering, []);
    });
});

describe("insertInGuildChannelOrdering", () => {
    test("inserts into undefined channel ordering", () => {
        const guild: { channel_ordering?: string[] } = {};

        const position = insertInGuildChannelOrdering(guild, "channel", 0);

        assert.equal(position, 0);
        assert.deepEqual(guild.channel_ordering, ["channel"]);
    });

    test("moves existing channels without duplicating them", () => {
        const guild = { channel_ordering: ["a", "b", "c"] };

        const position = insertInGuildChannelOrdering(guild, "a", 2);

        assert.equal(position, 2);
        assert.deepEqual(guild.channel_ordering, ["b", "c", "a"]);
    });

    test("inserts after parent channel ids", () => {
        const guild = { channel_ordering: ["parent", "sibling"] };

        const position = insertInGuildChannelOrdering(guild, "child", "parent");

        assert.equal(position, 1);
        assert.deepEqual(guild.channel_ordering, ["parent", "child", "sibling"]);
    });

    test("clamps numeric positions to the ordering bounds", () => {
        const guild = { channel_ordering: ["a"] };

        assert.equal(insertInGuildChannelOrdering(guild, "before", -10), 0);
        assert.deepEqual(guild.channel_ordering, ["before", "a"]);

        assert.equal(insertInGuildChannelOrdering(guild, "after", 10), 2);
        assert.deepEqual(guild.channel_ordering, ["before", "a", "after"]);
    });
});

describe("template channel ordering", () => {
    test("creates channels in template order when parents already precede children", () => {
        const channels = sortTemplateChannelsForCreation([
            { id: "category", position: 3 },
            { id: "child-1", parent_id: "category", position: 999 },
            { id: "child-2", parent_id: "category", position: 0 },
            { id: "text", position: 0 },
        ]);

        assert.deepEqual(
            channels.map((channel) => channel.id),
            ["category", "child-1", "child-2", "text"],
        );
    });

    test("creates parent channels before children when template input is malformed", () => {
        const channels = sortTemplateChannelsForCreation([
            { id: "child", parent_id: "category", position: 0 },
            { id: "category", position: 1 },
            { id: "text", position: 2 },
        ]);

        assert.deepEqual(
            channels.map((channel) => channel.id),
            ["category", "child", "text"],
        );
    });

    test("maps imported guild ordering from serialized template order instead of stale positions", () => {
        const serializedChannels = [
            { id: "category", position: 3 },
            { id: "child-1", parent_id: "category", position: 999 },
            { id: "child-2", parent_id: "category", position: 0 },
            { id: "text", position: 0 },
        ];
        const createdIds = new Map(serializedChannels.map((channel) => [channel, `new-${channel.id}`]));

        assert.deepEqual(
            mapTemplateChannelOrdering(serializedChannels, (channel) => createdIds.get(channel)),
            ["new-category", "new-child-1", "new-child-2", "new-text"],
        );
    });

    test("serializes template channels in stored guild ordering", () => {
        const channels = sortChannelsByChannelOrdering([{ id: "child-2" }, { id: "category" }, { id: "child-1" }, { id: "untracked" }], ["category", "child-1", "child-2"]);

        assert.deepEqual(
            channels.map((channel) => channel.id),
            ["category", "child-1", "child-2", "untracked"],
        );
    });
});
