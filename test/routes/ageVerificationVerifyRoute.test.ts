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
import { Authentication, ErrorHandler } from "@spacebar/api";
import express from "express";
import ageVerificationVerifyRouter, { AGE_VERIFICATION_UNSUPPORTED_MESSAGE } from "../../src/api/routes/age-verification/verify";

const coveredManifestIds = ["api:http:POST:/age-verification/verify/"];

describe("POST /age-verification/verify", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:POST:/age-verification/verify/"]);
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(express.json());
        app.use(Authentication);
        app.use("/age-verification/verify", ageVerificationVerifyRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/age-verification/verify", { method: "POST", body: {} });

        assert.equal(response.status, 401);
        assert.equal(response.body.code, 401);
        assert.equal(response.body.message, "Error: Missing Authorization Header");
    });

    test("rejects non-empty JSON bodies before unsupported provider handling", async () => {
        const app = setupAuthenticatedRoute();
        const response = await requestJson(app, "/age-verification/verify", {
            method: "POST",
            body: {
                verification_vendor_name: "K_ID",
            },
        });

        assert.equal(response.status, 400);
        assert.equal(response.body.code, 50035);
        assert.equal(response.body.message, "Invalid Form Body");
        assert.equal(typeof response.body.errors, "object");
    });

    test("fails closed without fabricating a third-party age verification session", async () => {
        const app = setupAuthenticatedRoute();
        const response = await requestJson(app, "/age-verification/verify", { method: "POST", body: {} });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: AGE_VERIFICATION_UNSUPPORTED_MESSAGE,
        });
    });

    test("also fails closed when clients send no body", async () => {
        const app = setupAuthenticatedRoute();
        const response = await requestJson(app, "/age-verification/verify", { method: "POST" });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: AGE_VERIFICATION_UNSUPPORTED_MESSAGE,
        });
    });

    test("documents route metadata and empty-body validation", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "age-verification", "verify.ts"), "utf-8");
        const schemaSource = readFileSync(path.join(process.cwd(), "src", "schemas", "uncategorised", "AgeVerificationVerifySchema.ts"), "utf-8");

        assert.match(routeSource, /summary:\s*"Verify Age"/);
        assert.match(routeSource, /requestBody:\s*"AgeVerificationVerifySchema"/);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /200:\s*\{/);
        assert.match(schemaSource, /type\s+AgeVerificationVerifySchema\s*=\s*Record<string,\s*never>/);
    });
});

function setupAuthenticatedRoute() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/age-verification/verify", ageVerificationVerifyRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string, options: { method?: string; body?: unknown } = {}) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: options.method,
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers: options.body == undefined ? undefined : { "content-type": "application/json" },
        });

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        await closeServer(server);
    }
}

async function closeServer(server: ReturnType<express.Express["listen"]>) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
