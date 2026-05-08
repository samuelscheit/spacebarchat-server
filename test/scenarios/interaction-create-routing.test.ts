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

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildBotInteractionCreatePayload, RoutedInteractionCreatePayload } from "../../src/api/util/handlers/InteractionCreateRouting";

function routedInteractionCreatePayload(id: string): RoutedInteractionCreatePayload {
    return {
        id,
        application_id: "100000000000000001",
        channel_id: "100000000000000002",
        type: 1,
        token: "interaction-token",
        version: 1,
        app_permissions: "0",
        entitlements: [],
        authorizing_integration_owners: { "1": "100000000000000003" },
        attachment_size_limit: 26_214_400,
        context: 2,
    };
}

describe("buildBotInteractionCreatePayload", () => {
    test("keeps the generated interaction id on the bot-facing event payload", () => {
        const interactionId = "100000000000000010";
        const memberId = "100000000000000003";
        const interactionData = routedInteractionCreatePayload(interactionId);

        const payload = buildBotInteractionCreatePayload(interactionData, { interactionId, memberId });

        assert.equal(payload.id, interactionId);
        assert.equal(payload.member_id, memberId);
        assert.deepEqual(payload, {
            ...interactionData,
            member_id: memberId,
        });
    });

    test("rejects payloads whose id diverges from the pending interaction id", () => {
        const interactionData = routedInteractionCreatePayload("100000000000000010");

        assert.throws(
            () => buildBotInteractionCreatePayload(interactionData, { interactionId: "100000000000000011", memberId: "100000000000000003" }),
            /must match the generated interaction id/,
        );
    });
});
