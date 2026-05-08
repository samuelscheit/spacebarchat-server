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

interface PendingInteractionCallbackState {
    timeout: NodeJS.Timeout;
    userId: string;
    nonce?: string;
}

interface PendingInteractionStore {
    delete(interactionId: string): boolean;
}

interface InteractionSuccessEventPayload {
    event: "INTERACTION_SUCCESS";
    user_id: string;
    data: {
        id: string;
        nonce: string;
    };
}

type InteractionSuccessEmitter = (payload: InteractionSuccessEventPayload) => Promise<void> | void;

export async function acknowledgeDeferredMessageUpdateInteraction(
    interactionId: string,
    interaction: PendingInteractionCallbackState,
    pendingInteractions: PendingInteractionStore,
    emitEvent: InteractionSuccessEmitter,
) {
    clearTimeout(interaction.timeout);

    await emitEvent({
        event: "INTERACTION_SUCCESS",
        user_id: interaction.userId,
        data: {
            id: interactionId,
            nonce: interaction.nonce ?? "",
        },
    });

    pendingInteractions.delete(interactionId);
}
