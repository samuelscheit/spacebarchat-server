import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DiscordApiErrors } from "../../../util/util/Constants";
import { requireOAuthAuthorizeApplication } from "./OAuthAuthorizeApplication";

describe("OAuth authorize application lookup", () => {
    test("loads the application bot relation before returning the authorize application", async (t) => {
        const application = { id: "app", bot: { id: "bot" } };
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => application),
        };

        assert.equal(await requireOAuthAuthorizeApplication("app", repository), application);
        assert.deepEqual(repository.findOne.mock.calls[0].arguments[0], {
            where: {
                id: "app",
            },
            relations: { bot: true },
        });
    });

    test("throws the shared unknown application error for missing applications", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        await assert.rejects(
            () => requireOAuthAuthorizeApplication("missing-app", repository),
            (error) => error === DiscordApiErrors.UNKNOWN_APPLICATION,
        );
        assert.equal(DiscordApiErrors.UNKNOWN_APPLICATION.httpStatus, 404);
    });

    test("throws the shared OAuth bot-absent error for applications without bot users", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ id: "app", bot: null })),
        };

        await assert.rejects(
            () => requireOAuthAuthorizeApplication("app", repository),
            (error) => error === DiscordApiErrors.OAUTH2_APPLICATION_BOT_ABSENT,
        );
        assert.equal(DiscordApiErrors.OAUTH2_APPLICATION_BOT_ABSENT.httpStatus, 400);
    });
});
