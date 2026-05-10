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
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import express from "express";
import { UNKNOWN_COMPANY_ERROR, createCompanyRouter, getCompany, serializeCompanyResponse, type CompanyRepositories } from "../../src/api/routes/company/#company_id";

function createApp(repositories: CompanyRepositories) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/company/:company_id", createCompanyRouter(repositories));
    app.use((error: { code?: number | string; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 400).json({ code: error.code, message: error.message });
    });

    return app;
}

async function requestJson(app: express.Express, path: string) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${path}`);
        const body = (await response.json()) as unknown;
        return { status: response.status, body };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /company/:company_id", () => {
    test("serializes a company-compatible row to the documented Company object", () => {
        const companyRow = {
            id: "1058932127820939295",
            name: "AlienTec",
            icon: "not-returned",
            owner_user_id: "not-returned",
        };

        assert.deepEqual(serializeCompanyResponse(companyRow), {
            id: "1058932127820939295",
            name: "AlienTec",
        });
    });

    test("loads a company by ID using the minimal injected projection", async (t) => {
        const companyRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                id: "1058932127820939295",
                name: "AlienTec",
            })),
        };

        assert.deepEqual(await getCompany("1058932127820939295", { companyRepository }), {
            id: "1058932127820939295",
            name: "AlienTec",
        });
        assert.deepEqual(companyRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: "1058932127820939295" },
            select: { id: true, name: true },
        });
    });

    test("returns unknown company for missing rows", async (t) => {
        const companyRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        await assert.rejects(
            () => getCompany("missing-company", { companyRepository }),
            (error) => error === UNKNOWN_COMPANY_ERROR,
        );
    });

    test("returns the mounted route response", async (t) => {
        const repositories = {
            companyRepository: {
                findOne: t.mock.fn(async (_options: unknown) => ({
                    id: "1058932127820939295",
                    name: "AlienTec",
                })),
            },
        };

        const response = await requestJson(createApp(repositories), "/company/1058932127820939295");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            id: "1058932127820939295",
            name: "AlienTec",
        });
    });

    test("returns a 404 API error from the mounted route when no company exists", async (t) => {
        const repositories = {
            companyRepository: {
                findOne: t.mock.fn(async (_options: unknown) => null),
            },
        };

        const response = await requestJson(createApp(repositories), "/company/missing-company");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: UNKNOWN_COMPANY_ERROR.code,
            message: UNKNOWN_COMPANY_ERROR.message,
        });
    });

    test("fails closed by default when no company backing is configured", async () => {
        const response = await requestJson(createApp({}), "/company/1058932127820939295");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: UNKNOWN_COMPANY_ERROR.code,
            message: UNKNOWN_COMPANY_ERROR.message,
        });
    });
});
