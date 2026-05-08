import { DiscordApiErrors } from "./Constants";

export type GroupDmRecipientRef = {
    user_id: string;
};

export function assertExistingGroupDmRecipient(recipients: readonly GroupDmRecipientRef[] | undefined, userId: string) {
    if (!recipients?.some((recipient) => recipient.user_id === userId)) {
        throw DiscordApiErrors.INVALID_RECIPIENT;
    }
}
