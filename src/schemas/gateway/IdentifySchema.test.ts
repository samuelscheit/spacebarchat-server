import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { instanceOf } from "lambert-server";
import { IdentifySchema } from "./IdentifySchema";

function identifyPayload(presence: object) {
    return {
        token: "token",
        presence,
    };
}

describe("IdentifySchema presence activities", () => {
    test("accepts activities that satisfy ActivitySchema through identify presence", () => {
        assert.equal(
            instanceOf(
                IdentifySchema,
                identifyPayload({
                    status: "online",
                    activities: [
                        {
                            name: "Activity",
                            type: 0,
                            party: { size: [1, 5] },
                        },
                    ],
                }),
            ),
            true,
        );
    });

    test("rejects invalid activity types through identify presence", () => {
        assert.throws(
            () =>
                instanceOf(
                    IdentifySchema,
                    identifyPayload({
                        status: "online",
                        activities: [
                            {
                                name: "Activity",
                                type: 99,
                            },
                        ],
                    }),
                ),
            /must be one of/,
        );
    });

    test("rejects malformed activity party sizes through identify presence", () => {
        assert.throws(
            () =>
                instanceOf(
                    IdentifySchema,
                    identifyPayload({
                        status: "online",
                        activities: [
                            {
                                name: "Activity",
                                type: 0,
                                party: { size: [1] },
                            },
                        ],
                    }),
                ),
            /exactly 2 items/,
        );
    });
});
