import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getChannelOrderInsertPoint, moveChannelInOrder } from "./ChannelOrdering";

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

    test("uses explicit positions before parent ids for single-channel patches", () => {
        assert.equal(getChannelOrderInsertPoint({ position: 0, parent_id: "category" }, false), 0);
    });

    test("uses non-null parent ids as category insert points for single-channel patches", () => {
        assert.equal(getChannelOrderInsertPoint({ parent_id: "category" }, false), "category");
    });

    test("preserves ordering when single-channel patches remove a parent without a position", () => {
        assert.equal(getChannelOrderInsertPoint({ parent_id: null }, false), undefined);
    });

    test("does not create guild ordering updates for thread patches", () => {
        assert.equal(getChannelOrderInsertPoint({ position: 0, parent_id: "category" }, true), undefined);
    });
});
