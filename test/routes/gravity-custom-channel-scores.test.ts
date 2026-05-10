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
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, test } from "node:test";
import express from "express";
import gravityCustomChannelScoresRouter from "../../src/api/routes/gravity-custom-channel-scores";

describe("GET /gravity-custom-channel-scores", () => {
    test("returns the Discord-compatible empty custom score array", async () => {
        const app = express();
        app.use("/gravity-custom-channel-scores", gravityCustomChannelScoresRouter);

        const { server, baseUrl } = await listen(app);
        try {
            const response = await fetch(`${baseUrl}/gravity-custom-channel-scores`);

            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), []);
        } finally {
            await close(server);
        }
    });

    test("declares authenticated response metadata", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "gravity-custom-channel-scores.ts"), "utf-8");

        assert.match(routeSource, /200:\s*{\s*body:\s*"GravityCustomChannelScoresResponse"/);
        assert.match(routeSource, /401:\s*{\s*body:\s*"APIErrorResponse"/);
    });
});

async function listen(app: express.Express) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    const address = server.address();
    assert(address && typeof address === "object");

    return {
        server,
        baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    };
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
