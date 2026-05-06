import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { DiscordApiErrors, Webhook } from "@spacebar/util";
import { Request, Response } from "express";
import { updateWebhookWithToken } from "./Webhook";

const originalFindOneOrFail = Webhook.findOneOrFail;

describe("PATCH /webhooks/:webhook_id/:token", () => {
    afterEach(() => {
        Webhook.findOneOrFail = originalFindOneOrFail;
    });

    test("rejects an invalid webhook token before applying metadata updates", async () => {
        let assigned = false;
        let saved = false;

        Webhook.findOneOrFail = ((options: unknown) => {
            assert.deepEqual(options, {
                where: { id: "webhook_id" },
                relations: { user: true, channel: true, source_channel: true, guild: true, source_guild: true, application: true },
            });

            return Promise.resolve({
                token: "valid_token",
                channel_id: "channel_id",
                guild_id: "guild_id",
                assign: () => {
                    assigned = true;
                },
                save: async () => {
                    saved = true;
                },
            });
        }) as typeof Webhook.findOneOrFail;

        const req = {
            params: { webhook_id: "webhook_id", token: "wrong_token" },
            body: { name: "Renamed webhook" },
        } as unknown as Request;
        const res = {} as Response;

        await assert.rejects(
            () => updateWebhookWithToken(req, res),
            (error) => {
                assert.equal(error, DiscordApiErrors.INVALID_WEBHOOK_TOKEN_PROVIDED);
                return true;
            },
        );
        assert.equal(assigned, false);
        assert.equal(saved, false);
    });
});
