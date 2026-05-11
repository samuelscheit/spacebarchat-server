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
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import consoleConnectRequestCancelRouter from "../../src/api/routes/consoles/connect-request/#nonce";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:DELETE:/consoles/connect-request/:nonce/"];

describe("DELETE /consoles/connect-request/:nonce", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:DELETE:/consoles/connect-request/:nonce/"]);
    });

    test("returns a 204 empty response for a console connection request nonce", async () => {
        const app = setupConsoleConnectRequestCancelRoute();

        const response = await request(app, "/consoles/connect-request/fgnmC0tT");

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
    });

    test("documents success and bearer-auth error response metadata", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "consoles", "connect-request", "#nonce.ts"), "utf-8");

        assert.match(routeSource, /summary:\s*"Cancel Console Connection Request"/);
        assert.match(routeSource, /204:\s*\{\}/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /200:\s*\{/);
    });
});

function setupConsoleConnectRequestCancelRoute() {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/consoles/connect-request/:nonce", consoleConnectRequestCancelRouter);
    app.use(ErrorHandler);

    return app;
}

async function request(app: express.Express, requestPath: string): Promise<{ status: number; body: string }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: "DELETE",
        });

        return {
            status: response.status,
            body: await response.text(),
        };
    } finally {
        server.close();
    }
}
