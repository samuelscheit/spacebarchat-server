/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Config } from "./Config";
import { DiscordApiErrors } from "./Constants";

export interface DmRecipientLimitRecipient {
    user_id: string;
}

// Discord's recipient limit is expressed in viewer-visible DM recipients,
// so the creator/owner is excluded and duplicate IDs are counted once.
export function normalizeDmRecipientIdsForLimit(recipients: readonly string[], creatorUserId: string): string[] {
    return [...new Set(recipients)].filter((recipientId) => recipientId !== creatorUserId);
}

export function getConfiguredDmRecipientLimit(): number {
    return Config.get().limits.channel.maxRecipients;
}

export function assertDmRecipientLimit(recipientCount: number, maxRecipients: number = getConfiguredDmRecipientLimit()) {
    if (recipientCount > maxRecipients) {
        throw DiscordApiErrors.MAXIMUM_NUMBER_OF_RECIPIENTS_REACHED.withParams(maxRecipients);
    }
}

export function normalizeAndAssertCreateDmRecipientsForLimit(recipients: readonly string[], creatorUserId: string): string[] {
    const normalizedRecipients = normalizeDmRecipientIdsForLimit(recipients, creatorUserId);
    assertDmRecipientLimit(normalizedRecipients.length);
    return normalizedRecipients;
}

export function countGroupDmRecipientsExcludingOwner(recipients: readonly DmRecipientLimitRecipient[] = [], ownerId?: string | null): number {
    return new Set(recipients.map((recipient) => recipient.user_id).filter((recipientId) => recipientId !== ownerId)).size;
}

export function assertCanAddGroupDmRecipient(
    recipients: readonly DmRecipientLimitRecipient[] = [],
    ownerId?: string | null,
    maxRecipients: number = getConfiguredDmRecipientLimit(),
) {
    const recipientCount = countGroupDmRecipientsExcludingOwner(recipients, ownerId);
    if (recipientCount >= maxRecipients) {
        throw DiscordApiErrors.MAXIMUM_NUMBER_OF_RECIPIENTS_REACHED.withParams(maxRecipients);
    }
}
