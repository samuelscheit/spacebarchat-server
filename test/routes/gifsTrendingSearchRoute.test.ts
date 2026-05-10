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
import { afterEach, describe, test } from "node:test";
import express from "express";
import { Authentication, ErrorHandler } from "../../src/api/middlewares";
import router, { buildTenorTrendingTermsUrl, parseGifTrendingSearchQuery } from "../../src/api/routes/gifs/trending-search";

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe("GET /gifs/trending-search", () => {
    test("parses documented defaults and clamps the suggested limit range", () => {
        assert.deepEqual(parseGifTrendingSearchQuery({}), {
            provider: "tenor",
            locale: "en-US",
            limit: 5,
        });

        assert.deepEqual(parseGifTrendingSearchQuery({ provider: "TENOR", locale: "de-DE", limit: "999" }), {
            provider: "tenor",
            locale: "de-DE",
            limit: 50,
        });

        assert.equal(parseGifTrendingSearchQuery({ limit: "0" }).limit, 1);
        assert.equal(parseGifTrendingSearchQuery({ limit: "not-a-number" }).limit, 5);
    });

    test("builds Tenor trending search term requests with encoded query fields", () => {
        const url = new URL(buildTenorTrendingTermsUrl("pt-BR", 12, "test key"));

        assert.equal(url.origin, "https://g.tenor.com");
        assert.equal(url.pathname, "/v1/trending_terms");
        assert.equal(url.searchParams.get("locale"), "pt-BR");
        assert.equal(url.searchParams.get("limit"), "12");
        assert.equal(url.searchParams.get("key"), "test key");
    });

    test("returns Tenor trending search terms and filters malformed provider terms", async () => {
        const requestedUrls: string[] = [];
        globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
            requestedUrls.push(url);

            return Response.json({ results: ["spacebar", 7, "cats", null], locale: "en-US" });
        }) as typeof fetch;

        const response = await requestJson(createRouteApp(), "/gifs/trending-search?locale=en-US&limit=2");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, ["spacebar", "cats"]);

        const tenorUrl = new URL(requestedUrls[0]);
        assert.equal(tenorUrl.pathname, "/v1/trending_terms");
        assert.equal(tenorUrl.searchParams.get("locale"), "en-US");
        assert.equal(tenorUrl.searchParams.get("limit"), "2");
    });

    test("returns an empty compatibility body for providers Spacebar does not back", async () => {
        let fetchCalled = false;
        globalThis.fetch = (async () => {
            fetchCalled = true;
            throw new Error("unsupported provider should not proxy");
        }) as typeof fetch;

        const response = await requestJson(createRouteApp(), "/gifs/trending-search?provider=giphy&limit=3");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.equal(fetchCalled, false);
    });

    test("keeps the route behind bearer authentication in the API middleware", async () => {
        const response = await requestJson(createAuthenticatedApp(), "/gifs/trending-search");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });
});

function createRouteApp() {
    const app = express();
    app.use("/gifs/trending-search", router);
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();
    app.use(Authentication);
    app.use("/gifs/trending-search", router);
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, path: string) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await originalFetch(`http://127.0.0.1:${address.port}${path}`);

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
