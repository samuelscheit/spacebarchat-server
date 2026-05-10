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
import router, {
    createUniqueUsernameSuggestion,
    normalizeUniqueUsernameSuggestionBase,
    uniqueUsernameSuggestionCandidate,
} from "../../src/api/routes/unique-username/username-suggestions-unauthed";

afterEach(() => {
    mock.restoreAll();
});

describe("GET /unique-username/username-suggestions-unauthed", () => {
    test("normalizes display names into migrated username-compatible suggestions", () => {
        assert.equal(normalizeUniqueUsernameSuggestionBase("Gnarp Gnap"), "gnarp.gnap");
        assert.equal(normalizeUniqueUsernameSuggestionBase("  Gn\u00e4..rp!!Gnap  "), "gna.rp.gnap");
        assert.equal(normalizeUniqueUsernameSuggestionBase("@#!"), "user");
        assert.equal(normalizeUniqueUsernameSuggestionBase("averylongdisplayname", 10), "averylongd");
        assert.equal(uniqueUsernameSuggestionCandidate("abcdefghij", 1, 10), "abcdefghi1");
    });

    test("chooses the first available local username candidate", async () => {
        const checked: string[] = [];
        const username = await createUniqueUsernameSuggestion("Gnarp Gnap", {
            maxLength: 32,
            isAvailable: async (candidate) => {
                checked.push(candidate);
                return candidate !== "gnarp.gnap" && candidate !== "gnarp.gnap1";
            },
        });

        assert.equal(username, "gnarp.gnap2");
        assert.deepEqual(checked, ["gnarp.gnap", "gnarp.gnap1", "gnarp.gnap2"]);
    });

    test("serves unauthenticated registration suggestions without requiring bearer auth", async () => {
        mock.method(Config, "get", () => ({ limits: { user: { maxUsername: 32 } } }) as ReturnType<typeof Config.get>);

        const taken = new Set(["gnarp.gnap"]);
        const lookups: string[] = [];
        mock.method(User, "findOne", async (options?: unknown) => {
            const username = (options as { where?: { username?: string } }).where?.username;
            assert.equal((options as { select?: { id?: boolean } }).select?.id, true);
            if (typeof username !== "string") assert.fail("expected username lookup");
            lookups.push(username);
            return taken.has(username) ? ({ id: "existing-user" } as User) : null;
        });

        const app = express();
        app.use(express.json());
        app.use(Authentication);
        app.use("/unique-username/username-suggestions-unauthed", router);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/unique-username/username-suggestions-unauthed?global_name=Gnarp%20Gnap");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { username: "gnarp.gnap1" });
        assert.deepEqual(lookups, ["gnarp.gnap", "gnarp.gnap1"]);
    });
});

async function requestJson(app: express.Express, path: string) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`);

        return {
            status: response.status,
            body: await response.json(),
        };
    } finally {
        server.close();
    }
}
