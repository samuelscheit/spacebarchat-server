import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { DiscordApiErrors } from "../../../util/util/Constants";

describe("OAuth2 authorize route errors", () => {
    test("keeps the shared unknown application error at the route-compatible status", () => {
        assert.equal(DiscordApiErrors.UNKNOWN_APPLICATION.code, 10002);
        assert.equal(DiscordApiErrors.UNKNOWN_APPLICATION.httpStatus, 404);
        assert.equal(DiscordApiErrors.OAUTH2_APPLICATION_BOT_ABSENT.code, 50010);
        assert.equal(DiscordApiErrors.OAUTH2_APPLICATION_BOT_ABSENT.httpStatus, 400);
    });

    test("uses DiscordApiErrors for known POST authorize application failures", async () => {
        const source = await readFile(path.join(process.cwd(), "src/api/routes/oauth2/authorize.ts"), "utf8");
        const postHandler = source.slice(source.indexOf("router.post("));

        assert.match(postHandler, /throw DiscordApiErrors\.UNKNOWN_APPLICATION/);
        assert.match(postHandler, /throw DiscordApiErrors\.OAUTH2_APPLICATION_BOT_ABSENT/);
        assert.doesNotMatch(postHandler, /new ApiError\("Unknown Application", 10002/);
        assert.doesNotMatch(postHandler, /new ApiError\("OAuth2 application does not have a bot", 50010/);
    });
});
