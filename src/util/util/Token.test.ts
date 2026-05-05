import assert from "node:assert/strict";
import { describe, test } from "node:test";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/spacebar";

const { getCheckTokenUserSelect, userSelectFromKeys }: typeof import("./Token") = require("./Token");

describe("Token select helpers", () => {
    test("converts user projection keys to TypeORM select notation", () => {
        assert.deepEqual(userSelectFromKeys(["id", "email", "rights"]), {
            id: true,
            email: true,
            rights: true,
        });
    });

    test("always selects fields required by token validation", () => {
        assert.deepEqual(getCheckTokenUserSelect({ email: true, data: false }), {
            email: true,
            id: true,
            bot: true,
            disabled: true,
            deleted: true,
            rights: true,
            data: true,
        });
    });
});
