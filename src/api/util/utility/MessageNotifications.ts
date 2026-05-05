export type MessageNotificationOptions = {
    suppress_notifications?: boolean;
};

export function shouldIncrementMentionCount(options: MessageNotificationOptions) {
    return options.suppress_notifications !== true;
}
