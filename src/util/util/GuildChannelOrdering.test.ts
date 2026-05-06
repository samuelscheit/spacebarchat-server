import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getGuildChannelOrdering, getGuildChannelOrderingColumnOptions, getGuildChannelPosition, insertInGuildChannelOrdering } from "./GuildChannelOrdering";

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
