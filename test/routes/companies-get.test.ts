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
import { Like } from "typeorm";
import { Authentication, ErrorHandler } from "../../src/api/middlewares";
import { createCompaniesRouter, parseCompanySearchQuery, searchCompanies, serializeCompanySearchResponse, type CompanySearchRepositories } from "../../src/api/routes/companies";

type JsonResponse = {
    status: number;
    body: unknown;
    text: string;
};

function createApp(repositories: CompanySearchRepositories = {}) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/companies", createCompaniesRouter(repositories));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();
    app.use(Authentication);
    app.use("/companies", createCompaniesRouter());
    app.use(ErrorHandler);

    return app;
}

async function request(app: express.Express, path: string): Promise<JsonResponse> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
        const text = await response.text();

        return {
            status: response.status,
            text,
            body: text ? (JSON.parse(text) as unknown) : undefined,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /companies", () => {
    test("parses the optional company name query", () => {
        assert.deepEqual(parseCompanySearchQuery({}), {});
        assert.deepEqual(parseCompanySearchQuery({ name: "" }), {});
        assert.deepEqual(parseCompanySearchQuery({ name: "   " }), {});
        assert.deepEqual(parseCompanySearchQuery({ name: " AlienTec " }), { name: "AlienTec" });
        assert.deepEqual(parseCompanySearchQuery({ name: ["Power", "Ignored"] }), { name: "Power" });
    });

    test("serializes only the documented Company object fields", () => {
        const company = {
            id: "1058932127820939295",
            name: "AlienTec",
            icon: "not-returned",
            owner_user_id: "not-returned",
        };

        assert.deepEqual(serializeCompanySearchResponse([company]), [
            {
                id: "1058932127820939295",
                name: "AlienTec",
            },
        ]);
    });

    test("searches by name using a bounded minimal projection", async (t) => {
        const companyRepository = {
            find: t.mock.fn(async (_options: unknown) => [
                {
                    id: "1058932127820939295",
                    name: "AlienTec",
                },
            ]),
        };

        assert.deepEqual(await searchCompanies("Alien", { companyRepository }), [
            {
                id: "1058932127820939295",
                name: "AlienTec",
            },
        ]);
        assert.deepEqual(companyRepository.find.mock.calls[0].arguments[0], {
            where: { name: Like("%Alien%") },
            select: { id: true, name: true },
            order: { name: "ASC" },
            take: 25,
        });
    });

    test("returns 204 with no body when no name query is provided", async (t) => {
        const companyRepository = {
            find: t.mock.fn(async () => {
                throw new Error("search should not run without a query");
            }),
        };

        const response = await request(createApp({ companyRepository }), "/companies");

        assert.equal(response.status, 204);
        assert.equal(response.text, "");
        assert.equal(companyRepository.find.mock.callCount(), 0);
    });

    test("returns companies that match the provided query", async (t) => {
        const repositories = {
            companyRepository: {
                find: t.mock.fn(async (_options: unknown) => [
                    {
                        id: "1058932127820939295",
                        name: "AlienTec",
                        icon: "not-returned",
                    },
                ]),
            },
        };

        const response = await request(createApp(repositories), "/companies?name=Alien");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [
            {
                id: "1058932127820939295",
                name: "AlienTec",
            },
        ]);
    });

    test("returns an empty search result by default when no company backing is configured", async () => {
        const response = await request(createApp(), "/companies?name=Alien");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("keeps the route behind bearer authentication in the API middleware", async () => {
        const response = await request(createAuthenticatedApp(), "/companies?name=Alien");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });
});
