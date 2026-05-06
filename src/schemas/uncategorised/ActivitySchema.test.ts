import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { instanceOf } from "lambert-server";
import { ActivitySchema } from "./ActivitySchema";

function activityPayload(activity: object) {
    return {
        status: "online",
        activities: [
            {
                name: "Activity",
                ...activity,
            },
        ],
    };
}

describe("ActivitySchema", () => {
    test("accepts activity types from zero through five", () => {
        for (const type of [0, 1, 2, 3, 4, 5]) {
            assert.equal(instanceOf(ActivitySchema, activityPayload({ type })), true);
        }
    });

    test("rejects activity types outside zero through five", () => {
        for (const type of [-1, 6, 99]) {
            assert.throws(() => instanceOf(ActivitySchema, activityPayload({ type })), /must be one of/);
        }
    });

    test("rejects non-integer numeric activity types", () => {
        assert.throws(() => instanceOf(ActivitySchema, activityPayload({ type: 1.5 })), /must be one of/);
    });

    test("accepts absent party size", () => {
        assert.equal(instanceOf(ActivitySchema, activityPayload({ type: 0, party: { id: "party-id" } })), true);
    });

    test("accepts party size with exactly two numbers", () => {
        assert.equal(instanceOf(ActivitySchema, activityPayload({ type: 0, party: { size: [1, 5] } })), true);
    });

    test("rejects party size with the wrong length", () => {
        assert.throws(() => instanceOf(ActivitySchema, activityPayload({ type: 0, party: { size: [1] } })), /exactly 2 items/);
        assert.throws(() => instanceOf(ActivitySchema, activityPayload({ type: 0, party: { size: [1, 2, 3] } })), /exactly 2 items/);
    });

    test("rejects party size with non-number entries", () => {
        assert.throws(() => instanceOf(ActivitySchema, activityPayload({ type: 0, party: { size: [1, "many"] } })), /must be a number/);
    });
});
