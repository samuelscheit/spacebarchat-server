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
import test from "node:test";
import { earliestPremiumGuildSince, toPartialConnectedAccountResponse, toProfileBadgeResponse } from "./userProfileResponse";

test("toPartialConnectedAccountResponse only exposes visible non-null metadata", () => {
    assert.deepEqual(
        toPartialConnectedAccountResponse({
            id: "connection-1",
            type: "github",
            name: "alice",
            verified: null,
            metadata_: null,
            metadata_visibility: 1,
        }),
        {
            id: "connection-1",
            type: "github",
            name: "alice",
            verified: false,
        },
    );

    assert.deepEqual(
        toPartialConnectedAccountResponse({
            id: "connection-2",
            type: "mastodon",
            name: "alice@example.com",
            verified: true,
            metadata_: { verified_at: "2026-05-06T00:00:00.000Z" },
            metadata_visibility: 0,
        }),
        {
            id: "connection-2",
            type: "mastodon",
            name: "alice@example.com",
            verified: true,
        },
    );

    assert.deepEqual(
        toPartialConnectedAccountResponse({
            id: "connection-3",
            type: "steam",
            name: "alice",
            verified: true,
            metadata_: { profile_url: "https://example.com/alice" },
            metadata_visibility: 1,
        }),
        {
            id: "connection-3",
            type: "steam",
            name: "alice",
            verified: true,
            metadata: { profile_url: "https://example.com/alice" },
        },
    );
});

test("toProfileBadgeResponse omits nullable database links", () => {
    assert.deepEqual(
        toProfileBadgeResponse({
            id: "early_supporter",
            description: "Early Supporter",
            icon: "supporter",
            link: null,
        }),
        {
            id: "early_supporter",
            description: "Early Supporter",
            icon: "supporter",
        },
    );

    assert.deepEqual(
        toProfileBadgeResponse({
            id: "partner",
            description: "Partner",
            icon: "partner",
            link: "https://example.com/partner",
        }),
        {
            id: "partner",
            description: "Partner",
            icon: "partner",
            link: "https://example.com/partner",
        },
    );
});

test("earliestPremiumGuildSince returns null when no membership is boosting", () => {
    assert.equal(earliestPremiumGuildSince([]), null);
    assert.equal(earliestPremiumGuildSince([{}, { premium_since: null }]), null);
});

test("earliestPremiumGuildSince returns the earliest boost timestamp", () => {
    assert.equal(earliestPremiumGuildSince([{ premium_since: 3000 }, { premium_since: null }, { premium_since: 1000 }, { premium_since: 2000 }]), 1000);
});
