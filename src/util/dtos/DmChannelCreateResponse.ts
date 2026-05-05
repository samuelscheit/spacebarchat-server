export type CreateDMChannelResponse = {
    recipients: { id: string }[];
};

export function getCreateDMChannelResponse<T extends CreateDMChannelResponse>(channel: T, _creator_user_id: string): T {
    return channel;
}
