import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { deleteMessagesInBatches } from "../../../util/handlers/PurgeMessages";

describe("deleteMessagesInBatches", () => {
    test("fetches and deletes messages in bounded batches while preserving deleted id order", async () => {
        const remainingIds = ["100", "101", "102", "103", "104"];
        const fetchLimits: number[] = [];
        const deletedBatches: string[][] = [];
        const emittedBatches: string[][] = [];

        const deletedCount = await deleteMessagesInBatches(
            async (limit) => {
                fetchLimits.push(limit);
                return remainingIds.slice(0, limit);
            },
            async (ids) => {
                deletedBatches.push([...ids]);
                remainingIds.splice(0, ids.length);
            },
            async (ids) => {
                emittedBatches.push([...ids]);
            },
            2,
        );

        assert.deepEqual(fetchLimits, [2, 2, 2, 2]);
        assert.deepEqual(deletedBatches, [["100", "101"], ["102", "103"], ["104"]]);
        assert.deepEqual(emittedBatches, [["100", "101"], ["102", "103"], ["104"]]);
        assert.equal(deletedCount, 5);
        assert.deepEqual(remainingIds, []);
    });

    test("rejects invalid batch sizes", async () => {
        await assert.rejects(() => deleteMessagesInBatches(async () => [], async () => undefined, undefined, 0), /positive integer/);
    });
});
