import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { instanceOf } from "lambert-server";
import { ActivitySchema } from "./ActivitySchema";

const Source = fs.readFileSync(path.join(process.cwd(), "src", "schemas", "uncategorised", "ActivitySchema.ts"), { encoding: "utf8" });
const Schemas = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "schemas.json"), { encoding: "utf8" })) as Record<
    string,
    {
        properties?: Record<string, unknown>;
        required?: string[];
        enum?: unknown[];
    }
>;

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

    test("rejects party size with null entries", () => {
        assert.throws(() => instanceOf(ActivitySchema, activityPayload({ type: 0, party: { size: [1, null] } })), /is required/);
    });

    test("keeps ActivitySchema types owned by schemas instead of util entities", () => {
        assert.equal(Source.includes('from "@spacebar/util"'), false);
        assert.equal(Source.includes("from '@spacebar/util'"), false);
    });

    test("keeps generated ActivitySchema references local Activity and Status definitions", () => {
        assert.deepEqual(Schemas.ActivitySchema.properties?.status, { $ref: "#/definitions/Status" });
        assert.deepEqual(Schemas.ActivitySchema.properties?.activities, {
            type: "array",
            items: {
                $ref: "#/definitions/Activity",
            },
        });
        assert.deepEqual(Schemas.Status.enum?.toSorted(), ["dnd", "idle", "invisible", "offline", "online", "unknown"]);
        assert.deepEqual(Schemas.ActivityType.enum, [0, 1, 2, 3, 4, 5]);
        assert.deepEqual(Schemas.Activity.required?.toSorted(), ["flags", "name", "session_id", "type"]);
    });
});
