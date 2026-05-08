import type { ReadyPrivateChannel } from "@spacebar/util";
import { ChannelType, type PublicUser } from "@spacebar/schemas";

type ReadyPrivateChannelCandidateSource = {
    icon?: string | null;
    id: string;
    flags: number;
    last_message_id?: string | null;
    name?: string | null;
    owner_id?: string | null;
    type: ChannelType;
    recipients?: {
        user_id?: string;
        user: {
            id: string;
            toPublicUser(): PublicUser;
        };
    }[];
};

export type ReadyPrivateChannelSource = ReadyPrivateChannelCandidateSource & {
    type: ChannelType.DM | ChannelType.GROUP_DM;
};

type ReadyPrivateChannelRecipientSource = {
    channel: ReadyPrivateChannelCandidateSource & {
        isDm?: () => boolean;
    };
};

type ReadyPrivateChannelRecipient = {
    channel: ReadyPrivateChannelSource & {
        isDm?: () => boolean;
    };
};

type CurrentReadyUserSource = {
    id: string;
    toPublicUser(): PublicUser;
};

function isReadyPrivateChannelSource(channel: ReadyPrivateChannelRecipientSource["channel"]): channel is ReadyPrivateChannelRecipient["channel"] {
    if (channel.isDm) return channel.isDm();
    return channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM;
}

function hasReadyPrivateChannelSource(recipient: ReadyPrivateChannelRecipientSource): recipient is ReadyPrivateChannelRecipient {
    return isReadyPrivateChannelSource(recipient.channel);
}

export function serializeReadyPrivateChannel(channel: ReadyPrivateChannelSource, currentUser: CurrentReadyUserSource): { channel: ReadyPrivateChannel; users: PublicUser[] } {
    const users = channel.recipients?.filter((recipient) => recipient.user.id !== currentUser.id).map((recipient) => recipient.user.toPublicUser()) ?? [];

    if (users.length === 0 && channel.type === ChannelType.DM) {
        users.push(currentUser.toPublicUser());
    }

    return {
        channel: {
            id: channel.id,
            flags: channel.flags,
            last_message_id: channel.last_message_id ?? undefined,
            type: channel.type,
            recipients: users,
            icon: channel.icon,
            name: channel.name,
            is_spam: false, // TODO
            owner_id: channel.owner_id ?? undefined,
        },
        users,
    };
}

export function serializeReadyPrivateChannels(recipients: ReadyPrivateChannelRecipientSource[], currentUser: CurrentReadyUserSource) {
    const users = new Set<PublicUser>();
    const channels = recipients.filter(hasReadyPrivateChannelSource).map(({ channel }) => {
        const serialized = serializeReadyPrivateChannel(channel, currentUser);
        serialized.users.forEach((user) => users.add(user));
        return serialized.channel;
    });

    return { channels, users };
}
