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
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import gravityRecommendedGuildsRouter from "../../src/api/routes/gravity-recommended-guilds";

describe("GET /gravity-recommended-guilds", () => {
    test("stays behind bearer auth", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/gravity-recommended-guilds"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/gravity-recommended-guilds?limit=24"), false);

        const app = express();
        app.use(Authentication);
        app.use("/gravity-recommended-guilds", gravityRecommendedGuildsRouter);
        app.use(ErrorHandler);

        const { server, baseUrl } = await listen(app);
        try {
            const response = await fetch(`${baseUrl}/gravity-recommended-guilds`);
            const body = (await response.json()) as { message?: string };

            assert.equal(response.status, 401);
            assert.match(body.message ?? "", /Missing Authorization Header/);
        } finally {
            await close(server);
        }
    });

    test("returns the Discord-compatible empty recommended guild wrapper", async () => {
        const app = express();
        app.use("/gravity-recommended-guilds", gravityRecommendedGuildsRouter);

        const { server, baseUrl } = await listen(app);
        try {
            const response = await fetch(`${baseUrl}/gravity-recommended-guilds?limit=24`);

            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { guilds: [] });
        } finally {
            await close(server);
        }
    });

    test("declares authenticated response metadata", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "gravity-recommended-guilds.ts"), "utf-8");

        assert.match(routeSource, /200:\s*{\s*body:\s*"GravityRecommendedGuildsResponse"/);
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
