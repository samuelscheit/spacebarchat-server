import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { messagePublicRelations, messagePublicWithThreadRelations } from "./MessagePublicRelations";

describe("Public message relation presets", () => {
    test("load role mentions wherever public message serialization is used", () => {
        assert.equal(messagePublicRelations.mention_roles, true);
        assert.equal(messagePublicWithThreadRelations.mention_roles, true);
    });

    test("thread preset includes the base public message relations", () => {
        for (const relation of Object.keys(messagePublicRelations) as (keyof typeof messagePublicRelations)[]) {
            assert.deepEqual(messagePublicWithThreadRelations[relation], messagePublicRelations[relation]);
        }

        assert.deepEqual(messagePublicWithThreadRelations.thread, {
            recipients: {
                user: true,
            },
        });
    });
});
