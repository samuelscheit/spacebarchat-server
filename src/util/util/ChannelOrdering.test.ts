import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
    getChannelOrderInsertPoint,
    getInvalidThreadChannelOrderFields,
    insertChannelInOrdering,
    moveChannelInOrder,
    normalizeChannelOrdering,
    removeChannelOrderingFromGuildSave,
} from "./ChannelOrdering";

function orderingAfterGuildUpdateSave<T extends { channel_ordering?: string[] | null | undefined }>(routeGuild: T, currentDatabaseOrdering: string[]) {
    removeChannelOrderingFromGuildSave(routeGuild);

    return Object.hasOwn(routeGuild, "channel_ordering") ? routeGuild.channel_ordering : currentDatabaseOrdering;
}

describe("Channel ordering helpers", () => {
    test("normalizes missing channel ordering to an empty array", () => {
        assert.deepEqual(normalizeChannelOrdering(undefined), []);
        assert.deepEqual(normalizeChannelOrdering(null), []);
    });

    test("inserts into missing channel ordering", () => {
        assert.deepEqual(insertChannelInOrdering(undefined, "channel_id", 0), {
            ordering: ["channel_id"],
            position: 0,
        });
    });

    test("moves existing channel instead of duplicating it", () => {
        assert.deepEqual(insertChannelInOrdering(["a", "b", "c"], "c", 1), {
            ordering: ["a", "c", "b"],
            position: 1,
        });
    });

    test("inserts after a parent channel id", () => {
        assert.deepEqual(insertChannelInOrdering(["parent", "sibling"], "child", "parent"), {
            ordering: ["parent", "child", "sibling"],
            position: 1,
        });
    });

    test("inserts at the front when the parent channel id is absent", () => {
        assert.deepEqual(insertChannelInOrdering(["sibling"], "child", "missing_parent"), {
            ordering: ["child", "sibling"],
            position: 0,
        });
    });

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

    test("rejects position updates for thread patches", () => {
        assert.deepEqual(getInvalidThreadChannelOrderFields({ position: 0 }, true), ["position"]);
    });

    test("rejects parent removal for thread patches", () => {
        assert.deepEqual(getInvalidThreadChannelOrderFields({ parent_id: null }, true), ["parent_id"]);
    });

    test("rejects parent id updates for thread patches", () => {
        assert.deepEqual(getInvalidThreadChannelOrderFields({ parent_id: "category" }, true), ["parent_id"]);
    });

    test("does not reject ordering fields for non-thread patches", () => {
        assert.deepEqual(getInvalidThreadChannelOrderFields({ position: 0, parent_id: null }, false), []);
    });

    test("preserves a created public updates channel after guild update save", () => {
        const routeGuild = { channel_ordering: ["existing"], public_updates_channel_id: "moderator" };

        assert.deepEqual(orderingAfterGuildUpdateSave(routeGuild, ["moderator", "existing"]), ["moderator", "existing"]);
        assert.equal(Object.hasOwn(routeGuild, "channel_ordering"), false);
    });

    test("preserves a created rules channel after guild update save", () => {
        const routeGuild = { channel_ordering: ["existing"], rules_channel_id: "rules" };

        assert.deepEqual(orderingAfterGuildUpdateSave(routeGuild, ["rules", "existing"]), ["rules", "existing"]);
        assert.equal(Object.hasOwn(routeGuild, "channel_ordering"), false);
    });

    test("preserves both community setup channels after guild update save", () => {
        const routeGuild = {
            channel_ordering: ["existing"],
            public_updates_channel_id: "moderator",
            rules_channel_id: "rules",
        };

        assert.deepEqual(orderingAfterGuildUpdateSave(routeGuild, ["rules", "moderator", "existing"]), ["rules", "moderator", "existing"]);
        assert.equal(Object.hasOwn(routeGuild, "channel_ordering"), false);
    });
});
