import { DiscordApiErrors } from "../../../util/util/Constants";

export type GroupDmRecipientRef = {
    user_id: string;
};

export function assertExistingGroupDmRecipient(recipients: GroupDmRecipientRef[] | undefined, userId: string) {
    if (!recipients?.some((recipient) => recipient.user_id === userId)) {
        throw DiscordApiErrors.INVALID_RECIPIENT;
    }
}
