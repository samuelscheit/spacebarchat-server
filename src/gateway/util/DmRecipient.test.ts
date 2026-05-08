import assert from "node:assert/strict";
import { test } from "node:test";
import { Channel, Recipient } from "@spacebar/util";
import { ChannelType } from "@spacebar/schemas";
import { hasLoadedDmChannel } from "./DmRecipient";

function recipientWithChannel(type: ChannelType, recipients?: Recipient[]) {
    const channel = Object.assign(new Channel(), { type, recipients });
    return Object.assign(new Recipient(), { channel });
}

test("hasLoadedDmChannel narrows recipients with loaded DM channels", () => {
    const channelRecipient = Object.assign(new Recipient(), { user_id: "friend", user: {} as Recipient["user"] });
    const recipient = recipientWithChannel(ChannelType.DM, [channelRecipient]);

    assert.equal(hasLoadedDmChannel(recipient), true);

    if (hasLoadedDmChannel(recipient)) {
        const dmType: ChannelType.DM | ChannelType.GROUP_DM = recipient.channel.type;
        const loadedRecipients: Recipient[] = recipient.channel.recipients;

        assert.equal(dmType, ChannelType.DM);
        assert.deepEqual(loadedRecipients, [channelRecipient]);
    }
});

test("hasLoadedDmChannel rejects non-DM channels and unloaded DM recipients", () => {
    assert.equal(hasLoadedDmChannel(recipientWithChannel(ChannelType.GUILD_TEXT, [])), false);
    assert.equal(hasLoadedDmChannel(recipientWithChannel(ChannelType.GROUP_DM)), false);
    assert.equal(hasLoadedDmChannel(recipientWithChannel(ChannelType.DM, [new Recipient()])), false);
});
