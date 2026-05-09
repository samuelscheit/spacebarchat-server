import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getBotApproximateGuildCount } from "../../../src/api/routes/oauth2/authorize";
import { Member } from "@spacebar/util";

describe("getBotApproximateGuildCount", () => {
    test("counts guild memberships for the bot user id", async (t) => {
        const originalCount = Member.count;
        const countCalls: unknown[] = [];

        t.after(() => {
            Member.count = originalCount;
        });

        Member.count = (async (options: unknown) => {
            countCalls.push(options);
            return 3;
        }) as typeof Member.count;

        assert.equal(await getBotApproximateGuildCount("bot-user"), 3);
        assert.deepEqual(countCalls[0], {
            where: { id: "bot-user" },
        });
    });
});
