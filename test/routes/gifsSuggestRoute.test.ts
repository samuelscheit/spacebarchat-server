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
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import { buildTenorSuggestUrl, createGifsSuggestRouter, parseGifSuggestQuery, type GifSuggestDependencies } from "../../src/api/routes/gifs/suggest";

const coveredManifestIds = ["api:http:GET:/gifs/suggest/"];

describe("GET /gifs/suggest", () => {
    test("documents the assigned manifest id and matches the documented public auth boundary", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/gifs/suggest/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/gifs/suggest?q=space"), true);
    });

    test("parses documented defaults and clamps the suggested limit range", () => {
        assert.deepEqual(parseGifSuggestQuery({ q: "space" }), {
            provider: "tenor",
            query: "space",
            locale: "en-US",
            limit: 20,
        });

        assert.deepEqual(parseGifSuggestQuery({ provider: "TENOR", q: "space cat", locale: "de-DE", limit: "999" }), {
            provider: "tenor",
            query: "space cat",
            locale: "de-DE",
            limit: 50,
        });

        assert.equal(parseGifSuggestQuery({ q: "space", limit: "0" }).limit, 1);
        assert.equal(parseGifSuggestQuery({ q: "space", limit: "not-a-number" }).limit, 20);
    });

    test("builds Tenor autocomplete requests with encoded query fields", () => {
        const url = new URL(buildTenorSuggestUrl("space cat", "pt-BR", 12, "test key"));

        assert.equal(url.origin, "https://g.tenor.com");
        assert.equal(url.pathname, "/v1/autocomplete");
        assert.equal(url.searchParams.get("q"), "space cat");
        assert.equal(url.searchParams.get("locale"), "pt-BR");
        assert.equal(url.searchParams.get("limit"), "12");
        assert.equal(url.searchParams.get("key"), "test key");
    });

    test("returns Tenor suggested search terms and filters malformed provider terms", async () => {
        const requestedUrls: string[] = [];
        const fetchImpl: typeof fetch = async (input) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
            requestedUrls.push(url);

            return Response.json({ results: ["spacebar", 7, "space cats", null], locale: "en-US" });
        };

        const response = await requestJson(
            createRouteApp({
                fetch: fetchImpl,
                getGifApiKey: () => "api-key",
            }),
            "/gifs/suggest?q=space%20cat&locale=en-US&limit=2",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, ["spacebar", "space cats"]);

        const tenorUrl = new URL(requestedUrls[0]);
        assert.equal(tenorUrl.pathname, "/v1/autocomplete");
        assert.equal(tenorUrl.searchParams.get("q"), "space cat");
        assert.equal(tenorUrl.searchParams.get("locale"), "en-US");
        assert.equal(tenorUrl.searchParams.get("limit"), "2");
        assert.equal(tenorUrl.searchParams.get("key"), "api-key");
    });

    test("returns an empty compatibility body for providers Spacebar does not back", async () => {
        let fetchCalled = false;
        const response = await requestJson(
            createRouteApp({
                fetch: (async () => {
                    fetchCalled = true;
                    throw new Error("unsupported provider should not proxy");
                }) as typeof fetch,
                getGifApiKey: () => "api-key",
            }),
            "/gifs/suggest?provider=giphy&q=space&limit=3",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.equal(fetchCalled, false);
    });

    test("rejects requests without a search query before calling Tenor", async () => {
        let fetchCalled = false;
        const response = await requestJson<{ code: number; message: string; errors: { q?: unknown } }>(
            createRouteApp({
                fetch: (async () => {
                    fetchCalled = true;
                    throw new Error("missing query should not proxy");
                }) as typeof fetch,
                getGifApiKey: () => "api-key",
            }),
            "/gifs/suggest",
        );

        assert.equal(response.status, 400);
        assert.equal(response.body.code, 50035);
        assert.equal(response.body.message, "Invalid Form Body");
        assert.ok(response.body.errors.q);
        assert.equal(fetchCalled, false);
    });

    test("surfaces Tenor upstream failures as a gateway error", async () => {
        const response = await requestJson<{ code: number; message: string }>(
            createRouteApp({
                fetch: (async () => Response.json({ error: "unavailable" }, { status: 503 })) as typeof fetch,
                getGifApiKey: () => "api-key",
            }),
            "/gifs/suggest?q=space",
        );

        assert.equal(response.status, 502);
        assert.equal(response.body.code, 502);
        assert.match(response.body.message, /Tenor GIF suggestions failed/);
    });

    test("serves unauthenticated requests through the API middleware", async () => {
        const response = await requestJson(createAuthenticatedApp(), "/gifs/suggest?q=space");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, ["spacebar"]);
    });
});

function createRouteApp(dependencies: GifSuggestDependencies) {
    const app = express();
    app.use("/gifs/suggest", createGifsSuggestRouter(dependencies));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();
    app.use(Authentication);
    app.use(
        "/gifs/suggest",
        createGifsSuggestRouter({
            fetch: (async () => Response.json({ results: ["spacebar"] })) as typeof fetch,
            getGifApiKey: () => "api-key",
        }),
    );
    app.use(ErrorHandler);

    return app;
}

async function requestJson<TBody = unknown>(app: express.Express, path: string) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`);

        return {
            status: response.status,
            body: (await response.json()) as TBody,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
