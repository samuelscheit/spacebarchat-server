import assert from "node:assert/strict";
import { test } from "node:test";
import { ChannelType } from "../../schemas/api/channels/Channel";
import type { PublicUser } from "../../schemas/api/users/User";
import type { ReadyEventData, ReadyPrivateChannel } from "./Event";

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
    const dm: ReadyPrivateChannel = {
        id: "1081004946872352959",
        flags: 0,
        is_spam: false,
        last_message_id: "1081004946872352960",
        recipients: [recipient],
        type: ChannelType.DM,
    };

    const groupDm: ReadyPrivateChannel = {
        id: "1081004946872352961",
        flags: 0,
        is_spam: false,
        recipients: [recipient],
        type: ChannelType.GROUP_DM,
    };

    const readyPrivateChannels: ReadyEventData["private_channels"] = [dm, groupDm];

    assert.deepEqual(
        readyPrivateChannels.map((channel) => channel.type),
        [ChannelType.DM, ChannelType.GROUP_DM],
    );
});
