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
import { describe, test, type TestContext } from "node:test";
import express from "express";
import { ConnectedAccount, DiscordApiErrors } from "@spacebar/util";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import xboxHandoffRouter, { XBOX_HANDOFF_CONNECTION_TYPE, XBOX_HANDOFF_UNSUPPORTED_MESSAGE, assertHasActiveXboxHandoffAccount } from "../../src/api/routes/consoles/xbox-handoff";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/consoles/xbox-handoff/"];

describe("GET /consoles/xbox-handoff", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/consoles/xbox-handoff/"]);
    });

    test("queries only the caller's Xbox connected accounts", async (t) => {
        const harness = setupXboxHandoffRoute(t, {
            userId: "viewer",
            accounts: [{ external_id: "xuid", revoked: false }],
        });

        await requestJson(harness.app, "/consoles/xbox-handoff");

        assert.deepEqual(harness.connectedAccountFindOptions[0], {
            where: {
                user_id: "viewer",
                type: XBOX_HANDOFF_CONNECTION_TYPE,
            },
            select: {
                external_id: true,
                revoked: true,
            },
            order: {
                external_id: "ASC",
            },
        });
    });

    test("returns Unknown Connection when the user has no Xbox connected account", async (t) => {
        const harness = setupXboxHandoffRoute(t, { accounts: [] });

        const response = await requestJson(harness.app, "/consoles/xbox-handoff");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_CONNECTION.code,
            message: DiscordApiErrors.UNKNOWN_CONNECTION.message,
        });
    });

    test("returns Connection Revoked when every Xbox account is revoked", async (t) => {
        const harness = setupXboxHandoffRoute(t, {
            accounts: [{ external_id: "revoked-xuid", revoked: true }],
        });

        const response = await requestJson(harness.app, "/consoles/xbox-handoff");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.CONNECTION_REVOKED.code,
            message: DiscordApiErrors.CONNECTION_REVOKED.message,
        });
    });

    test("returns an explicit unsupported error for a locally linked Xbox account", async (t) => {
        const harness = setupXboxHandoffRoute(t, {
            accounts: [
                { external_id: "revoked-xuid", revoked: true },
                { external_id: "active-xuid", revoked: false },
            ],
        });

        const response = await requestJson(harness.app, "/consoles/xbox-handoff");

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: XBOX_HANDOFF_UNSUPPORTED_MESSAGE,
        });
    });

    test("documents error response schemas and bearer-auth metadata", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "consoles", "xbox-handoff.ts"), "utf-8");

        assert.match(routeSource, /summary:\s*"Get Xbox Handoff"/);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /200:\s*\{/);
    });

    test("uses shared Discord API errors for missing or revoked linked accounts", () => {
        assert.throws(() => assertHasActiveXboxHandoffAccount([]), {
            code: DiscordApiErrors.UNKNOWN_CONNECTION.code,
        });
        assert.throws(() => assertHasActiveXboxHandoffAccount([{ external_id: "xuid", revoked: true }]), {
            code: DiscordApiErrors.CONNECTION_REVOKED.code,
        });
        assert.doesNotThrow(() =>
            assertHasActiveXboxHandoffAccount([
                { external_id: "revoked-xuid", revoked: true },
                { external_id: "active-xuid", revoked: false },
            ]),
        );
    });
});

type TestAccount = {
    external_id: string;
    revoked: boolean;
};

type SetupOptions = {
    accounts?: TestAccount[];
    userId?: string;
};

function setupXboxHandoffRoute(t: TestContext, options: SetupOptions) {
    const connectedAccountFindOptions: unknown[] = [];

    t.mock.method(ConnectedAccount, "find", async (findOptions: unknown) => {
        connectedAccountFindOptions.push(findOptions);
        return (options.accounts ?? []) as never;
    });

    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        next();
    });
    app.use("/consoles/xbox-handoff", xboxHandoffRouter);
    app.use(ErrorHandler);

    return {
        app,
        get connectedAccountFindOptions() {
            return connectedAccountFindOptions;
        },
    };
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        server.close();
    }
}
