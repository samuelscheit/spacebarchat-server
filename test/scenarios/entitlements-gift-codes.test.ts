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
import { createServer, type Server } from "node:http";
import { describe, test } from "node:test";
import { ErrorHandler } from "@spacebar/api";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import giftCodeRouter from "../../src/api/routes/entitlements/gift-codes/#gift_code_code";

const coveredManifestIds = ["api:http:GET:/entitlements/gift-codes/:gift_code_code/"];

describe("GET /entitlements/gift-codes/:gift_code_code", () => {
    test("returns unknown gift code when no durable gift-code state exists", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/entitlements/gift-codes/:gift_code_code/"]);

        const app = express();
        app.use("/entitlements/gift-codes/:gift_code_code", giftCodeRouter);
        app.use(ErrorHandler);
        const server = createServer(app);
        const port = await listen(server);

        try {
            const response = await fetch(`http://127.0.0.1:${port}/entitlements/gift-codes/2CG6SV9QtRxerJTgCYNDnU7M?with_application=true&with_subscription_plan=true`);

            assert.equal(response.status, DiscordApiErrors.UNKNOWN_GIFT_CODE.httpStatus);
            assert.match(response.headers.get("content-type") ?? "", /application\/json/);

            const body = (await response.json()) as Record<string, unknown>;
            assert.equal(body.code, DiscordApiErrors.UNKNOWN_GIFT_CODE.code);
            assert.equal(body.message, DiscordApiErrors.UNKNOWN_GIFT_CODE.message);
        } finally {
            await close(server);
        }
    });
});

async function listen(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    assert(address && typeof address === "object");
    return address.port;
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
