import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { moveChannelInOrder } from "./ChannelOrdering";

describe("channel ordering", () => {
    test("moves an existing channel to a numeric position", () => {
        assert.deepEqual(moveChannelInOrder(["category", "alpha", "beta", "gamma"], "beta", 1), {
            channel_ordering: ["category", "beta", "alpha", "gamma"],
            position: 1,
        });
    });

    test("inserts a channel directly after a parent channel id", () => {
        assert.deepEqual(moveChannelInOrder(["category", "alpha", "beta"], "alpha", "category"), {
            channel_ordering: ["category", "alpha", "beta"],
            position: 1,
        });
    });

    test("removes duplicate channel ids before inserting", () => {
        assert.deepEqual(moveChannelInOrder(["category", "alpha", "beta", "alpha"], "alpha", 2), {
            channel_ordering: ["category", "beta", "alpha"],
            position: 2,
        });
    });
});
