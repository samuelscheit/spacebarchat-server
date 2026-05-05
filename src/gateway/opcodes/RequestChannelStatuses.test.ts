import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { FindManyOptions } from "typeorm";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/spacebar";

describe("RequestChannelStatuses", () => {
    test("loads persisted voice channel statuses for a guild", async () => {
        const { Channel } = require("@spacebar/util");
        const { ChannelType } = require("@spacebar/schemas");
        const { getChannelStatuses } = require("./RequestChannelStatuses");
        const originalFind = Channel.find;
        let options: FindManyOptions | undefined;

        try {
            Channel.find = async (findOptions: FindManyOptions) => {
                options = findOptions;
                return [
                    { id: "1000", status: "Daily standup" },
                    { id: "1001", status: "Onboarding" },
                ];
            };

            const statuses = await getChannelStatuses("42");

            assert.deepEqual(statuses, [
                { id: "1000", status: "Daily standup" },
                { id: "1001", status: "Onboarding" },
            ]);
            const where = options?.where as Record<string, unknown>;
            assert.equal(where.guild_id, "42");
            assert.equal(where.type, ChannelType.GUILD_VOICE);
            assert.deepEqual(options?.select, { id: true, status: true });
            assert.deepEqual(options?.order, { id: "ASC" });
        } finally {
            Channel.find = originalFind;
        }
    });
});
