import type { Channel, Recipient } from "@spacebar/util";
import type { ChannelType } from "@spacebar/schemas";

export type RecipientWithLoadedDmChannel = Recipient & {
    channel: Channel & {
        type: ChannelType.DM | ChannelType.GROUP_DM;
        recipients: Array<Recipient & { user: Recipient["user"] }>;
    };
};

export function hasLoadedDmChannel(recipient: Recipient): recipient is RecipientWithLoadedDmChannel {
    return recipient.channel?.isDm() === true && Array.isArray(recipient.channel.recipients) && recipient.channel.recipients.every((recipient) => recipient.user !== undefined);
}
