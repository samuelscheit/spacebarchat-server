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
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { User } from "@spacebar/util";
import { ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import contentInventoryUsersOutboxRouter, { buildContentInventoryOutboxResponse } from "../../src/api/routes/content-inventory/users/#user_id/outbox";

const coveredManifestIds = ["api:http:GET:/content-inventory/users/:user_id/outbox/"];

function createApp(userId = "caller") {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/content-inventory/users/:user_id/outbox", contentInventoryUsersOutboxRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, routePath: string) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${routePath}`);

        return {
            status: response.status,
            body: await response.json(),
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function entityNotFoundError() {
    return Object.assign(new Error('Could not find any entity of type "User" matching: {}'), { name: "EntityNotFoundError" });
}

describe("GET /content-inventory/users/:user_id/outbox", () => {
    test("documents the assigned manifest id and bearer-auth status", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/content-inventory/users/:user_id/outbox/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/content-inventory/users/123/outbox"), false);
    });

    test("documents response metadata for the source-backed compatibility route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "content-inventory", "users", "#user_id", "outbox.ts"), "utf-8");

        assert.match(routeSource, /summary:\s*"Get Content Inventory Outbox"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ContentInventoryOutboxResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("returns an empty outbox for an existing path user without requiring path ownership", async (t) => {
        const lookups: unknown[] = [];
        t.mock.method(User, "findOneOrFail", async (options: unknown) => {
            lookups.push(options);
            return { id: "target-user" } as User;
        });

        const response = await requestJson(createApp("caller-user"), "/content-inventory/users/target-user/outbox");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, buildContentInventoryOutboxResponse());
        assert.deepEqual(lookups, [
            {
                where: { id: "target-user" },
                select: { id: true },
            },
        ]);
    });

    test("fails closed when the path user does not exist", async (t) => {
        t.mock.method(User, "findOneOrFail", async () => {
            throw entityNotFoundError();
        });

        const response = await requestJson(createApp(), "/content-inventory/users/missing-user/outbox");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: 404,
            message: "User could not be found",
        });
    });
});
