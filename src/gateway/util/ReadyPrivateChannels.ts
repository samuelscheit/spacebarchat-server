import { ChannelType, type PublicUser } from "@spacebar/schemas";
import { serializeReadyPrivateChannel as serializeReadyPrivateChannelDTO, type ReadyPrivateChannel, type ReadyPrivateChannelSource } from "@spacebar/util";

type ReadyPrivateChannelCandidateSource = ReadyPrivateChannelSource & {
    isDm?: () => boolean;
};

type ReadyPrivateChannelSerializableSource = ReadyPrivateChannelSource & {
    type: ChannelType.DM | ChannelType.GROUP_DM;
};

type ReadyPrivateChannelRecipientSource = {
    channel: ReadyPrivateChannelCandidateSource;
};

type ReadyPrivateChannelRecipient = {
    channel: ReadyPrivateChannelSerializableSource & { isDm?: () => boolean };
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

function serializeGatewayReadyPrivateChannel(
    channel: ReadyPrivateChannelSerializableSource,
    currentUser: CurrentReadyUserSource,
): { channel: ReadyPrivateChannel; users: PublicUser[] } {
    return serializeReadyPrivateChannelDTO(channel, currentUser.id, currentUser.toPublicUser());
}

export function serializeReadyPrivateChannels(recipients: ReadyPrivateChannelRecipientSource[], currentUser: CurrentReadyUserSource) {
    const users = new Set<PublicUser>();
    const channels = recipients.filter(hasReadyPrivateChannelSource).map(({ channel }) => {
        const serialized = serializeGatewayReadyPrivateChannel(channel, currentUser);
        serialized.users.forEach((user) => users.add(user));
        return serialized.channel;
    });

    return { channels, users };
}
