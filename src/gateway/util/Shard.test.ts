import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createGatewayShard, getShardIdForGuild, isGuildOnShard } from "./Shard";

describe("gateway sharding", () => {
    test("accepts shard ids from zero through count minus one", () => {
        assert.deepEqual(createGatewayShard([0n, 2n]), { id: 0n, count: 2n });
        assert.deepEqual(createGatewayShard([1n, 2n]), { id: 1n, count: 2n });
    });

    test("rejects invalid identify shard tuples", () => {
        assert.equal(createGatewayShard(undefined), undefined);
        assert.equal(createGatewayShard([2n, 2n]), undefined);
        assert.equal(createGatewayShard([3n, 2n]), undefined);
        assert.equal(createGatewayShard([-1n, 2n]), undefined);
        assert.equal(createGatewayShard([0n, 0n]), undefined);
    });

    test("routes guilds with Discord's snowflake shard formula", () => {
        const guildOnShard0 = (8n << 22n).toString();
        const guildOnShard1 = (9n << 22n).toString();

        assert.equal(getShardIdForGuild(guildOnShard0, 2n), 0n);
        assert.equal(getShardIdForGuild(guildOnShard1, 2n), 1n);
        assert.equal(isGuildOnShard(guildOnShard0, { id: 0n, count: 2n }), true);
        assert.equal(isGuildOnShard(guildOnShard1, { id: 0n, count: 2n }), false);
    });

    test("keeps all guilds when no shard was requested", () => {
        assert.equal(isGuildOnShard("1", undefined), true);
    });
});
