import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DiscordApiErrors } from "./Constants";

describe("DiscordApiErrors", () => {
    test("uses the OAuth authorize application error responses", () => {
        assert.deepEqual(
            {
                code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
                httpStatus: DiscordApiErrors.UNKNOWN_APPLICATION.httpStatus,
                message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
            },
            {
                code: 10002,
                httpStatus: 404,
                message: "Unknown application",
            },
        );

        assert.deepEqual(
            {
                code: DiscordApiErrors.OAUTH2_APPLICATION_BOT_ABSENT.code,
                httpStatus: DiscordApiErrors.OAUTH2_APPLICATION_BOT_ABSENT.httpStatus,
                message: DiscordApiErrors.OAUTH2_APPLICATION_BOT_ABSENT.message,
            },
            {
                code: 50010,
                httpStatus: 400,
                message: "OAuth2 application does not have a bot",
            },
        );
    });
});
