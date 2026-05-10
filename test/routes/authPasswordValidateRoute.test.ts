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
import { Config } from "@spacebar/util";
import { nonCoercingAjv } from "@spacebar/schemas";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import passwordValidateRouter, { buildPasswordValidateResponse } from "../../src/api/routes/auth/password/validate";

const coveredManifestIds = ["api:http:POST:/auth/password/validate/"];

const passwordPolicy = {
    minLength: 8,
    minNumbers: 2,
    minUpperCase: 1,
    minSymbols: 1,
    blocklist: [" password123! "],
};

afterEach(() => {
    mock.restoreAll();
});

describe("POST /auth/password/validate", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:POST:/auth/password/validate/"]);
    });

    test("matches the unauthenticated auth boundary", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/auth/password/validate"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/auth/password/validate/"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/auth/password/validate"), false);
    });

    test("builds validity and strength from the configured registration password policy", () => {
        assert.deepEqual(buildPasswordValidateResponse("UniquePass12!", passwordPolicy), {
            valid: true,
            password_strength: 4,
        });
        assert.deepEqual(buildPasswordValidateResponse("aaaaaaaa", passwordPolicy), {
            valid: false,
            password_strength: 0,
        });
        assert.deepEqual(buildPasswordValidateResponse("Password123!", passwordPolicy), {
            valid: false,
            password_strength: 0,
        });
    });

    test("serves password validation without bearer authorization", async () => {
        mock.method(Config, "get", createConfig);

        const app = createApp();

        assert.deepEqual(await requestJson(app, "/auth/password/validate", { password: "UniquePass12!" }), {
            status: 200,
            body: {
                valid: true,
                password_strength: 4,
            },
        });
        assert.deepEqual(await requestJson(app, "/auth/password/validate", { password: "aaaaaaaa" }), {
            status: 200,
            body: {
                valid: false,
                password_strength: 0,
            },
        });
    });

    test("rejects malformed bodies without scalar coercion", async () => {
        mock.method(Config, "get", createConfig);

        const schema = nonCoercingAjv.getSchema("PasswordValidateSchema");
        assert.ok(schema);
        assert.equal(schema({ password: "UniquePass12!" }), true);
        assert.equal(schema({ password: 12345678 }), false);
        assert.equal(schema({ password: "a".repeat(73) }), false);
        assert.equal(schema({}), false);

        const response = await requestJson(createApp(), "/auth/password/validate", { password: 12345678 });

        assert.equal(response.status, 400);
        assert.equal(response.body.code, 50035);
        assert.equal(response.body.message, "Invalid Form Body");
    });
});

function createConfig() {
    return {
        register: {
            password: passwordPolicy,
        },
    } as ReturnType<typeof Config.get>;
}

function createApp() {
    const app = express();
    app.use(express.json());
    app.use(Authentication);
    app.use("/auth/password/validate", passwordValidateRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string, body: unknown) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(body),
        });

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
