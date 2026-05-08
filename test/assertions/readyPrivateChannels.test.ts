import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReadyEventData, ReadyPrivateChannel } from "@spacebar/util";
import { ChannelType } from "../../src/schemas/api/channels/Channel";
import type { PublicUser } from "../../src/schemas/api/users/User";

const recipient = {
    id: "1081004946872352958",
    username: "recipient",
    discriminator: "0001",
    avatar: undefined,
    public_flags: 0,
    bio: "",
    bot: false,
    premium_type: 0,
} as PublicUser;

test("ReadyPrivateChannel describes READY DM and group DM private_channels entries", () => {
    const dm = {
        id: "1081004946872352959",
        flags: 0,
        is_spam: false,
        last_message_id: "1081004946872352960",
        recipients: [recipient],
        type: ChannelType.DM,
    } satisfies ReadyPrivateChannel;

    const groupDm = {
        id: "1081004946872352961",
        flags: 0,
        icon: null,
        is_spam: false,
        name: "Group DM",
        owner_id: "1081004946872352962",
        recipients: [recipient],
        type: ChannelType.GROUP_DM,
    } satisfies ReadyPrivateChannel;

    const readyPrivateChannels: ReadyEventData["private_channels"] = [dm, groupDm];

    assert.deepEqual(
        readyPrivateChannels.map((channel) => ({
            icon: channel.icon,
            name: channel.name,
            owner_id: channel.owner_id,
            type: channel.type,
        })),
        [
            { icon: undefined, name: undefined, owner_id: undefined, type: ChannelType.DM },
            { icon: null, name: "Group DM", owner_id: "1081004946872352962", type: ChannelType.GROUP_DM },
        ],
    );
});
