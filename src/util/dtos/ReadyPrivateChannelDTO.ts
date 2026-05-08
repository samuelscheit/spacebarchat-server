import type { ChannelType, PublicUser } from "@spacebar/schemas";
import type { ReadyPrivateChannel } from "../interfaces/Event";
import { hasChannelSpamFlag } from "../util/ChannelFlags";

type ReadyPrivateChannelRecipient = {
    user: {
        id: string;
        toPublicUser(): PublicUser;
    };
};

export type ReadyPrivateChannelSource = {
    id: string;
    flags: number;
    icon?: string | null;
    last_message_id?: string | null;
    name?: string | null;
    owner_id?: string | null;
    recipients?: ReadyPrivateChannelRecipient[];
    type: ChannelType;
};

export type ReadyPrivateChannelSerialization = {
    channel: ReadyPrivateChannel;
    users: PublicUser[];
};

const READY_CHANNEL_TYPE_DM = 1 as ChannelType.DM;
const READY_CHANNEL_TYPE_GROUP_DM = 3 as ChannelType.GROUP_DM;

export function serializeReadyPrivateChannel(channel: ReadyPrivateChannelSource, currentUserId: string, currentUser: PublicUser): ReadyPrivateChannelSerialization {
    if (channel.type !== READY_CHANNEL_TYPE_DM && channel.type !== READY_CHANNEL_TYPE_GROUP_DM) {
        throw new TypeError(`Cannot serialize non-DM channel ${channel.id} for READY private_channels`);
    }

    let recipients = channel.recipients?.filter((recipient) => recipient.user.id !== currentUserId).map((recipient) => recipient.user.toPublicUser()) ?? [];

    // Keep compatibility with Discord READY payloads for orphaned one-to-one DMs.
    if (recipients.length === 0 && channel.type === READY_CHANNEL_TYPE_DM) {
        recipients = [currentUser];
    }

    return {
        channel: {
            id: channel.id,
            flags: channel.flags,
            last_message_id: channel.last_message_id,
            type: channel.type,
            recipients,
            icon: channel.icon,
            name: channel.name,
            is_spam: hasChannelSpamFlag(channel.flags),
            owner_id: channel.owner_id || undefined,
        },
        users: recipients,
    };
}
