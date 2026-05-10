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
import { afterEach, describe, mock, test } from "node:test";
import express from "express";
import { Config, User } from "@spacebar/util";
import { Authentication, ErrorHandler } from "../../src/api/middlewares";
import router, { isUniqueUsernameAttemptEligible } from "../../src/api/routes/unique-username/username-attempt-unauthed";

afterEach(() => {
    mock.restoreAll();
});

describe("POST /unique-username/username-attempt-unauthed", () => {
    test("applies migrated unique username syntax and instance blocks before availability lookup", () => {
        const policy = {
            maxLength: 32,
            blockedContains: ["discord"],
            blockedEquals: ["everyone", "here"],
        };

        assert.equal(isUniqueUsernameAttemptEligible("gnarp.gnap", policy), true);
        assert.equal(isUniqueUsernameAttemptEligible("gnarp_gnap0", policy), true);
        assert.equal(isUniqueUsernameAttemptEligible("Gnap", policy), false);
        assert.equal(isUniqueUsernameAttemptEligible("gnarp gnap", policy), false);
        assert.equal(isUniqueUsernameAttemptEligible("gnarp-gnap", policy), false);
        assert.equal(isUniqueUsernameAttemptEligible("gnarp..gnap", policy), false);
        assert.equal(isUniqueUsernameAttemptEligible("g", policy), false);
        assert.equal(isUniqueUsernameAttemptEligible("g".repeat(33), policy), false);
        assert.equal(isUniqueUsernameAttemptEligible("discordfan", policy), false);
        assert.equal(isUniqueUsernameAttemptEligible("everyone", policy), false);
    });

    test("serves unauthenticated local username availability", async () => {
        mock.method(
            Config,
            "get",
            () =>
                ({
                    limits: { user: { maxUsername: 32 } },
                    user: { blockedContains: ["discord"], blockedEquals: ["everyone", "here"] },
                }) as ReturnType<typeof Config.get>,
        );

        const taken = new Set(["gnarp.gnap"]);
        const lookups: string[] = [];
        mock.method(User, "createQueryBuilder", (alias: string) => {
            assert.equal(alias, "user");
            let username = "";
            return {
                select(selection: string) {
                    assert.equal(selection, "user.id");
                    return this;
                },
                where(sql: string, parameters: { username?: string }) {
                    assert.equal(sql, "LOWER(user.username) = :username");
                    if (typeof parameters.username !== "string") assert.fail("expected username lookup");
                    username = parameters.username;
                    lookups.push(username);
                    return this;
                },
                async getOne() {
                    return taken.has(username) ? ({ id: "existing-user" } as User) : null;
                },
            };
        });

        const app = express();
        app.use(express.json());
        app.use(Authentication);
        app.use("/unique-username/username-attempt-unauthed", router);
        app.use(ErrorHandler);

        assert.deepEqual(await requestJson(app, "/unique-username/username-attempt-unauthed", { username: "gnarp.gnap" }), {
            status: 200,
            body: { taken: true },
        });
        assert.deepEqual(await requestJson(app, "/unique-username/username-attempt-unauthed", { username: "gnarp.gnap1" }), {
            status: 200,
            body: { taken: false },
        });
        assert.deepEqual(await requestJson(app, "/unique-username/username-attempt-unauthed", { username: "gnarp..gnap" }), {
            status: 200,
            body: { taken: null },
        });

        assert.deepEqual(lookups, ["gnarp.gnap", "gnarp.gnap1"]);
    });
});

async function requestJson(app: express.Express, path: string, body: unknown) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(body),
        });

        return {
            status: response.status,
            body: await response.json(),
        };
    } finally {
        server.close();
    }
}
