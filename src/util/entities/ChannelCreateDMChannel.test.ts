import assert from "node:assert/strict";
import { describe, test } from "node:test";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";

describe("Channel.createDMChannel recipient validation", () => {
    test("rejects unknown one-to-one DM recipients with Discord's invalid recipient error", async (t) => {
        const { Channel, DiscordApiErrors, User } = await import("../index.js");
        const originalFind = User.find;

        t.after(() => {
            User.find = originalFind;
        });

        User.find = (async () => []) as typeof User.find;

        await assert.rejects(
            () => Channel.createDMChannel(["missing-recipient"], "creator"),
            (error) => error === DiscordApiErrors.INVALID_RECIPIENT,
        );
    });

    test("rejects unknown group DM recipients before channel persistence", async (t) => {
        const { Channel, DiscordApiErrors, User } = await import("../index.js");
        const originalFind = User.find;
        const originalCreate = Channel.create;
        let attemptedPersistence = false;

        t.after(() => {
            User.find = originalFind;
            Channel.create = originalCreate;
        });

        User.find = (async () => [{ id: "known-recipient" }]) as typeof User.find;
        Channel.create = ((...args: Parameters<typeof Channel.create>) => {
            attemptedPersistence = true;
            return originalCreate.apply(Channel, args);
        }) as typeof Channel.create;

        await assert.rejects(
            () => Channel.createDMChannel(["known-recipient", "missing-recipient"], "creator"),
            (error) => error === DiscordApiErrors.INVALID_RECIPIENT,
        );
        assert.equal(attemptedPersistence, false);
    });

    test("does not validate self-only note-to-self channels as invalid recipients", async (t) => {
        const { Channel, Recipient, User } = await import("../index.js");
        const { DmChannelDTO } = await import("../dtos/DmChannelDTO.js");
        const originalFind = User.find;
        const originalFindRecipient = Recipient.find;
        const originalCreateRecipient = Recipient.create;
        const originalCreate = Channel.create;
        const originalDtoFrom = DmChannelDTO.from;
        let validatedRecipients = false;

        t.after(() => {
            User.find = originalFind;
            Recipient.find = originalFindRecipient;
            Recipient.create = originalCreateRecipient;
            Channel.create = originalCreate;
            DmChannelDTO.from = originalDtoFrom;
        });

        User.find = (async () => {
            validatedRecipients = true;
            return [];
        }) as typeof User.find;
        Recipient.find = (async () => []) as typeof Recipient.find;
        Recipient.create = ((recipient: unknown) => recipient) as typeof Recipient.create;
        Channel.create = ((entityLike: unknown) => ({
            ...(entityLike as object),
            id: "note-to-self-channel",
            save: async function () {
                return this;
            },
        })) as typeof Channel.create;
        DmChannelDTO.from = (async (channel: unknown) => ({
            ...(channel as object),
            forRecipient() {
                return this;
            },
        })) as unknown as typeof DmChannelDTO.from;

        const channel = await Channel.createDMChannel(["creator"], "creator");

        assert.equal(validatedRecipients, false);
        assert.equal(channel.id, "note-to-self-channel");
    });
});
