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
import { ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import discoveryRouter from "../../src/api/routes/discovery";

const coveredManifestIds = ["api:http:GET:/discovery/valid-term"];

function createApp() {
    const app = express();
    app.use("/discovery", discoveryRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson<TBody = unknown>(path: string) {
    const server = createApp().listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`);

        return {
            status: response.status,
            body: (await response.json()) as TBody,
        };
    } finally {
        server.close();
    }
}

describe("GET /discovery/valid-term", () => {
    test("documents the assigned manifest id and stays behind bearer auth", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/discovery/valid-term"]);
        assert.equal(isNoAuthorizationRoute("GET", "/discovery/valid-term?term=spacebar"), false);
    });

    test("returns valid true for a non-empty supported search term", async () => {
        const response = await requestJson<{ valid: boolean }>("/discovery/valid-term?term=spacebar");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { valid: true });
    });

    test("returns valid false for terms outside local structural search limits", async () => {
        const response = await requestJson<{ valid: boolean }>(`/discovery/valid-term?term=${"a".repeat(101)}`);

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { valid: false });
    });

    test("rejects requests without the required term query parameter", async () => {
        const response = await requestJson<{ code: number; message: string; errors: { term?: unknown } }>("/discovery/valid-term");

        assert.equal(response.status, 400);
        assert.equal(response.body.code, 50035);
        assert.equal(response.body.message, "Invalid Form Body");
        assert.ok(response.body.errors.term);
    });
});
