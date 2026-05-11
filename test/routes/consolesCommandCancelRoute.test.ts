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
import express, { type Request } from "express";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import consoleCommandCancelRouter from "../../src/api/routes/consoles/#connection_type/devices/#device_id/commands/#command_id";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:DELETE:/consoles/:connection_type/devices/:device_id/commands/:command_id/"];

describe("DELETE /consoles/:connection_type/devices/:device_id/commands/:command_id", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:DELETE:/consoles/:connection_type/devices/:device_id/commands/:command_id/"]);
    });

    test("returns a 204 empty response for supported PlayStation console command cancellation", async () => {
        const app = setupConsoleCommandCancelRoute();

        for (const connectionType of ["playstation", "playstation-stg"]) {
            const response = await request(app, `/consoles/${connectionType}/devices/1371598138300956672/commands/1371598138300956673`);

            assert.equal(response.status, 204);
            assert.equal(response.body, "");
        }
    });

    test("rejects unsupported console command connection types with supported choices", async () => {
        const app = setupConsoleCommandCancelRoute();

        const response = await request(app, "/consoles/xbox/devices/1371598138300956672/commands/1371598138300956673");

        assert.equal(response.status, 400);
        assert.deepEqual(JSON.parse(response.body), {
            code: 50035,
            message: "Invalid Form Body",
            errors: {
                connection_type: {
                    _errors: [
                        {
                            code: "BASE_TYPE_CHOICES",
                            message: "Must be one of playstation, playstation-stg",
                        },
                    ],
                },
            },
        });
    });

    test("documents success and bearer-auth error response metadata", () => {
        const routeSource = readFileSync(
            path.join(process.cwd(), "src", "api", "routes", "consoles", "#connection_type", "devices", "#device_id", "commands", "#command_id.ts"),
            "utf-8",
        );

        assert.match(routeSource, /summary:\s*"Cancel Console Command"/);
        assert.match(routeSource, /204:\s*\{\}/);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /200:\s*\{/);
    });
});

function setupConsoleCommandCancelRoute() {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        req.t = ((_key: string, options?: { types?: string }) => `Must be one of ${options?.types ?? ""}`) as Request["t"];
        next();
    });
    app.use("/consoles/:connection_type/devices/:device_id/commands/:command_id", consoleCommandCancelRouter);
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
