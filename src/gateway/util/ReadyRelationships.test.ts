import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { RelationshipType } from "../../schemas/uncategorised/RelationshipPutSchema";
import { Snowflake } from "../../util/util/Snowflake";
import { readyRelationshipSinceFromId, serializeReadyRelationship, serializeReadyRelationships } from "./ReadyRelationships";

function snowflakeFor(date: string): string {
    return (BigInt(Date.parse(date) - Snowflake.EPOCH) << 22n).toString();
}

describe("READY relationship serialization", () => {
    test("serializes relationships with the READY-specific payload shape", () => {
        const relationship = {
            id: snowflakeFor("2026-05-07T21:43:05.000Z"),
            to_id: "related-user-id",
            type: RelationshipType.friends,
            nickname: undefined,
            to: {
                id: "related-user-id",
                toPublicUser() {
                    throw new Error("READY relationship serialization should not embed the public user");
                },
            },
        };

        const payload = serializeReadyRelationship(relationship);

        assert.deepEqual(payload, {
            id: "related-user-id",
            user_id: "related-user-id",
            type: RelationshipType.friends,
            nickname: null,
            since: "2026-05-07T21:43:05.000+00:00",
            is_spam_request: false,
            user_ignored: false,
        });
        assert.equal("user" in payload, false);
    });

    test("uses to_id even when the target user relation is not loaded", () => {
        assert.deepEqual(
            serializeReadyRelationship({
                id: snowflakeFor("2026-05-07T21:43:05.000Z"),
                to_id: "related-user-id",
                type: RelationshipType.outgoing,
                nickname: "Friend",
            }),
            {
                id: "related-user-id",
                user_id: "related-user-id",
                type: RelationshipType.outgoing,
                nickname: "Friend",
                since: "2026-05-07T21:43:05.000+00:00",
                is_spam_request: false,
                user_ignored: false,
            },
        );
    });

    test("does not mutate relationship inputs while serializing an array", () => {
        const relationship = {
            id: "not-a-snowflake",
            to_id: "blocked-user-id",
            type: RelationshipType.blocked,
            nickname: null,
        };

        assert.deepEqual(serializeReadyRelationships([relationship]), [
            {
                id: "blocked-user-id",
                user_id: "blocked-user-id",
                type: RelationshipType.blocked,
                nickname: null,
                since: null,
                is_spam_request: false,
                user_ignored: false,
            },
        ]);
        assert.deepEqual(relationship, {
            id: "not-a-snowflake",
            to_id: "blocked-user-id",
            type: RelationshipType.blocked,
            nickname: null,
        });
    });

    test("returns null since when a relationship row id is absent or not a snowflake", () => {
        assert.equal(readyRelationshipSinceFromId(undefined), null);
        assert.equal(readyRelationshipSinceFromId("relationship-row-id"), null);
    });
});
