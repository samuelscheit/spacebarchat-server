import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { DeleteResult } from "typeorm";
import { DiscordApiErrors } from "./Constants";
import { assertExistingGroupDmRecipient } from "./GroupDmRecipients";

describe("group DM recipient validation", () => {
    test("accepts an existing group DM recipient", () => {
        assert.doesNotThrow(() => assertExistingGroupDmRecipient([{ user_id: "owner-id" }, { user_id: "member-id" }], "member-id"));
    });

    test("rejects a target user that is not a group DM recipient as an invalid recipient", () => {
        assert.throws(
            () => assertExistingGroupDmRecipient([{ user_id: "owner-id" }, { user_id: "member-id" }], "missing-id"),
            (error) => error === DiscordApiErrors.INVALID_RECIPIENT,
        );
    });

    test("rejects missing recipient relations as invalid recipients", () => {
        assert.throws(
            () => assertExistingGroupDmRecipient(undefined, "missing-id"),
            (error) => error === DiscordApiErrors.INVALID_RECIPIENT,
        );
    });

    test("rejects empty recipient relations as invalid recipients", () => {
        assert.throws(
            () => assertExistingGroupDmRecipient([], "missing-id"),
            (error) => error === DiscordApiErrors.INVALID_RECIPIENT,
        );
    });

    test("removeRecipientFromChannel rejects invalid recipients before deleting or emitting", async (t) => {
        const { DmChannelDTO } = require("../dtos") as typeof import("../dtos");
        const eventModule = require("./Event") as typeof import("./Event");
        const { Channel } = require("../entities/Channel") as typeof import("../entities/Channel");
        const { Recipient } = require("../entities/Recipient") as typeof import("../entities/Recipient");
        const { User } = require("../entities/User") as typeof import("../entities/User");

        const deleteRecipient = t.mock.method(Recipient, "delete", async () => ({ affected: 1 }) as DeleteResult);
        const deleteChannel = t.mock.method(Channel, "deleteChannel", async () => undefined);
        const toDto = t.mock.method(DmChannelDTO, "from", async () => ({}) as InstanceType<typeof DmChannelDTO>);
        const emit = t.mock.method(eventModule, "emitEvent", async () => undefined);
        const findUser = t.mock.method(User, "findOneOrFail", async () => ({}) as InstanceType<typeof User>);
        const channel = {
            id: "channel-id",
            recipients: [{ user_id: "owner-id" }, { user_id: "member-id" }],
        } as InstanceType<typeof Channel>;

        await assert.rejects(
            () => Channel.removeRecipientFromChannel(channel, "missing-id"),
            (error) => error === DiscordApiErrors.INVALID_RECIPIENT,
        );

        assert.equal(deleteRecipient.mock.callCount(), 0);
        assert.equal(deleteChannel.mock.callCount(), 0);
        assert.equal(toDto.mock.callCount(), 0);
        assert.equal(emit.mock.callCount(), 0);
        assert.equal(findUser.mock.callCount(), 0);
        assert.deepEqual(
            channel.recipients?.map((recipient) => recipient.user_id),
            ["owner-id", "member-id"],
        );
    });

    test("removeRecipientFromChannel removes valid recipients and emits removal events", async (t) => {
        const { DmChannelDTO } = require("../dtos") as typeof import("../dtos");
        const eventModule = require("./Event") as typeof import("./Event");
        const { Channel } = require("../entities/Channel") as typeof import("../entities/Channel");
        const { Recipient } = require("../entities/Recipient") as typeof import("../entities/Recipient");
        const { User } = require("../entities/User") as typeof import("../entities/User");

        const deletedCriteria: unknown[] = [];
        const emittedEvents: unknown[] = [];

        const deleteRecipient = t.mock.method(Recipient, "delete", async (criteria: unknown) => {
            deletedCriteria.push(criteria);
            return { affected: 1 } as DeleteResult;
        });
        const toDto = t.mock.method(
            DmChannelDTO,
            "from",
            async (_channel: unknown, excludedRecipients?: string[]) => ({ id: "channel-id", excludedRecipients }) as unknown as InstanceType<typeof DmChannelDTO>,
        );
        const emit = t.mock.method(eventModule, "emitEvent", async (payload: unknown) => {
            emittedEvents.push(payload);
        });
        const findUser = t.mock.method(
            User,
            "findOneOrFail",
            async () =>
                ({
                    id: "member-id",
                    username: "member",
                    discriminator: "0001",
                    avatar: null,
                    public_flags: 0,
                    badge_ids: null,
                }) as unknown as InstanceType<typeof User>,
        );
        const channel = {
            id: "channel-id",
            owner_id: "owner-id",
            recipients: [{ user_id: "owner-id" }, { user_id: "member-id" }],
            save: async () => assert.fail("owner should not change while the owner remains a recipient"),
        } as unknown as InstanceType<typeof Channel>;

        await Channel.removeRecipientFromChannel(channel, "member-id");

        assert.deepEqual(deletedCriteria, [{ channel_id: "channel-id", user_id: "member-id" }]);
        assert.deepEqual(
            channel.recipients?.map((recipient) => recipient.user_id),
            ["owner-id"],
        );
        assert.equal(toDto.mock.callCount(), 1);
        assert.equal(findUser.mock.callCount(), 1);
        assert.equal(deleteRecipient.mock.callCount(), 1);
        assert.equal(emit.mock.callCount(), 2);
        assert.deepEqual(
            emittedEvents.map((event) => (event as { event: string }).event),
            ["CHANNEL_DELETE", "CHANNEL_RECIPIENT_REMOVE"],
        );
    });
});
