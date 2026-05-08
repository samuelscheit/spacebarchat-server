import assert from "node:assert/strict";
import { describe, test } from "node:test";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";

describe("group DM recipient route guards", () => {
    test("rejects adding an existing group DM recipient as invalid", async () => {
        const { assertCanAddGroupDmRecipient } = await import("./recipients.js");
        const { DiscordApiErrors } = await import("../../../../util/index.js");

        assert.throws(
            () =>
                assertCanAddGroupDmRecipient(
                    {
                        recipients: [{ user_id: "existing-user" }],
                    },
                    "existing-user",
                ),
            (error) => error === DiscordApiErrors.INVALID_RECIPIENT,
        );
    });

    test("allows adding a user who is not already in the group DM", async () => {
        const { assertCanAddGroupDmRecipient } = await import("./recipients.js");

        assert.doesNotThrow(() =>
            assertCanAddGroupDmRecipient(
                {
                    recipients: [{ user_id: "existing-user" }],
                },
                "new-user",
            ),
        );
    });
});
