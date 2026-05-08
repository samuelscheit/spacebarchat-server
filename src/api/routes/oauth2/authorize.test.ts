import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getBotApproximateGuildCount } from "./authorize";
import { Member } from "../../../util/entities";

describe("getBotApproximateGuildCount", () => {
    test("counts guild memberships for the bot user id", async (t) => {
        const count = t.mock.method(Member, "count", async (_options: unknown) => 3);

        assert.equal(await getBotApproximateGuildCount("bot-user"), 3);
        assert.deepEqual(count.mock.calls[0].arguments[0], {
            where: { id: "bot-user" },
        });
    });
});
