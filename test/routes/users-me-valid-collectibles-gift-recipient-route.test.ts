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
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    createCollectiblesGiftRecipientRouter,
    getCollectiblesGiftRecipientEligibility,
    getValidCollectiblesGiftRecipient,
    parseCollectiblesGiftRecipientQuery,
    type CollectiblesGiftRecipientEligibilityOptions,
    type CollectiblesGiftRecipientEligibilityProvider,
} from "../../src/api/routes/users/@me/valid-collectibles-gift-recipient";

const coveredManifestIds = ["api:http:GET:/users/@me/valid-collectibles-gift-recipient/"];
const assignedSourcePath = "/users/@me/valid-collectibles-gift-recipient";
const assignedRouteName = "GET_USERS__ME_VALID_COLLECTIBLES_GIFT_RECIPIENT";

function assertInvalidFormBody(action: () => unknown) {
    assert.throws(action, (error: unknown) => (error as { code?: number }).code === 50035);
}

function createRouteApp(eligibilityProvider?: CollectiblesGiftRecipientEligibilityProvider) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "100000000000000001";
        next();
    });
    app.use("/users/@me/valid-collectibles-gift-recipient", createCollectiblesGiftRecipientRouter(eligibilityProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();
    app.use(Authentication);
    app.use("/users/@me/valid-collectibles-gift-recipient", createCollectiblesGiftRecipientRouter());
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, path: string) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`);

        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /users/@me/valid-collectibles-gift-recipient", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/valid-collectibles-gift-recipient/"]);
        assert.equal(assignedSourcePath, "/users/@me/valid-collectibles-gift-recipient");
        assert.equal(assignedRouteName, "GET_USERS__ME_VALID_COLLECTIBLES_GIFT_RECIPIENT");
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/users/@me/valid-collectibles-gift-recipient?recipient_id=2&sku_id=3"), false);

        const response = await requestJson(createAuthenticatedApp(), "/users/@me/valid-collectibles-gift-recipient?recipient_id=2&sku_id=3");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("validates documented query snowflakes and passes sender context to the eligibility provider", async () => {
        let receivedOptions: CollectiblesGiftRecipientEligibilityOptions | undefined;
        const app = createRouteApp((options) => {
            receivedOptions = options;
            return true;
        });

        assert.deepEqual(parseCollectiblesGiftRecipientQuery({ recipient_id: "200000000000000002", sku_id: "300000000000000003" } as never), {
            recipient_id: "200000000000000002",
            sku_id: "300000000000000003",
        });

        const response = await requestJson(app, "/users/@me/valid-collectibles-gift-recipient?recipient_id=200000000000000002&sku_id=300000000000000003");

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            sender_id: "100000000000000001",
            recipient_id: "200000000000000002",
            sku_id: "300000000000000003",
        });
        assert.deepEqual(response.body, { valid: true });
    });

    test("rejects missing or malformed required query fields", async () => {
        assertInvalidFormBody(() => parseCollectiblesGiftRecipientQuery({ recipient_id: "0", sku_id: "300000000000000003" } as never));
        assertInvalidFormBody(() => parseCollectiblesGiftRecipientQuery({ recipient_id: "2", sku_id: "300000000000000003" } as never));
        assertInvalidFormBody(() => parseCollectiblesGiftRecipientQuery({ recipient_id: "200000000000000002", sku_id: "0" } as never));
        assertInvalidFormBody(() => parseCollectiblesGiftRecipientQuery({ recipient_id: "200000000000000002", sku_id: "3" } as never));

        const missingRecipient = await requestJson(createRouteApp(), "/users/@me/valid-collectibles-gift-recipient?sku_id=300000000000000003");
        const malformedSku = await requestJson(createRouteApp(), "/users/@me/valid-collectibles-gift-recipient?recipient_id=200000000000000002&sku_id=not-a-sku");
        const shortRecipient = await requestJson(createRouteApp(), "/users/@me/valid-collectibles-gift-recipient?recipient_id=2&sku_id=300000000000000003");
        const zeroSku = await requestJson(createRouteApp(), "/users/@me/valid-collectibles-gift-recipient?recipient_id=200000000000000002&sku_id=0");

        assert.equal(missingRecipient.status, 400);
        assert.equal((missingRecipient.body as { code?: number }).code, 50035);
        assert.equal(malformedSku.status, 400);
        assert.equal((malformedSku.body as { code?: number }).code, 50035);
        assert.equal(shortRecipient.status, 400);
        assert.equal((shortRecipient.body as { code?: number }).code, 50035);
        assert.equal(zeroSku.status, 400);
        assert.equal((zeroSku.body as { code?: number }).code, 50035);
    });

    test("fails closed when Spacebar has no local collectible gift eligibility backing", async () => {
        assert.equal(
            getCollectiblesGiftRecipientEligibility({
                sender_id: "100000000000000001",
                recipient_id: "200000000000000002",
                sku_id: "300000000000000003",
            }),
            false,
        );

        let providerCalled = false;
        const selfGiftResponse = await getValidCollectiblesGiftRecipient(
            {
                sender_id: "100000000000000001",
                recipient_id: "100000000000000001",
                sku_id: "300000000000000003",
            },
            () => {
                providerCalled = true;
                return true;
            },
        );

        assert.deepEqual(selfGiftResponse, { valid: false });
        assert.equal(providerCalled, false);

        const response = await requestJson(createRouteApp(), "/users/@me/valid-collectibles-gift-recipient?recipient_id=200000000000000002&sku_id=300000000000000003");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { valid: false });
    });
});
