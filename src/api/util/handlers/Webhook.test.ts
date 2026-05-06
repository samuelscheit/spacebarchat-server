import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { DiscordApiErrors, Webhook } from "@spacebar/util";
import { Request, Response } from "express";
import { updateWebhookWithToken } from "./Webhook";

const originalFindOne = Webhook.findOne;

describe("PATCH /webhooks/:webhook_id/:token", () => {
    afterEach(() => {
        Webhook.findOne = originalFindOne;
    });

    test("returns the Discord unknown webhook error when the id is missing", async () => {
        Webhook.findOne = (() => Promise.resolve(null)) as typeof Webhook.findOne;

        const req = {
            params: { webhook_id: "missing_webhook_id", token: "valid_token" },
            body: { name: "Renamed webhook" },
        } as unknown as Request;
        const res = {} as Response;

        await assert.rejects(
            () => updateWebhookWithToken(req, res),
            (error) => {
                assert.equal(error, DiscordApiErrors.UNKNOWN_WEBHOOK);
                return true;
            },
        );
    });

    test("rejects an invalid webhook token before applying metadata updates", async () => {
        let assigned = false;
        let saved = false;

        Webhook.findOne = ((options: unknown) => {
            assert.deepEqual(options, {
                where: { id: "webhook_id" },
                relations: { user: true, channel: true, source_channel: true, guild: true, source_guild: true, application: true },
            });

            return Promise.resolve({
                id: "webhook_id",
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
        }) as typeof Webhook.findOne;

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

    test("only applies token-auth metadata fields and returns the updated webhook", async () => {
        let assigned: unknown;
        let saved = false;
        let responseBody: unknown;

        Webhook.findOne = (() =>
            Promise.resolve({
                id: "webhook_id",
                token: "valid_token",
                channel_id: "original_channel_id",
                guild_id: "guild_id",
                assign: (update: unknown) => {
                    assigned = update;
                },
                save: async () => {
                    saved = true;
                },
            })) as typeof Webhook.findOne;

        const req = {
            params: { webhook_id: "webhook_id", token: "valid_token" },
            body: { name: "Renamed webhook", channel_id: "attacker_channel_id" },
        } as unknown as Request;
        const res = {
            json: (body: unknown) => {
                responseBody = body;
                return res;
            },
        } as Response;

        await updateWebhookWithToken(req, res);

        assert.deepEqual(assigned, { name: "Renamed webhook" });
        assert.equal(saved, true);
        assert.equal((responseBody as { id: string }).id, "webhook_id");
        assert.equal((responseBody as { token: string }).token, "valid_token");
        assert.equal((responseBody as { channel_id: string }).channel_id, "original_channel_id");
        assert.match((responseBody as { url: string }).url, /\/webhooks\/webhook_id\/valid_token$/);
    });
});
