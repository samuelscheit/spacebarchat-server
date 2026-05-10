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
import type { TenorGif } from "@spacebar/schemas";
import { ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    createIntegrationsTenorSearchRouter,
    createTenorSearchUrl,
    toIntegrationTenorGif,
    type IntegrationsTenorSearchDependencies,
} from "../../src/api/routes/integrations/tenor/search";

const coveredManifestIds = ["api:http:GET:/integrations/tenor/search/"];

function tenorMedia(url = "https://media.tenor.com/RbG_9Eh9KLoAAAAS/alien-alien-reveal.gif", dims = [100, 90]) {
    const media = {
        preview: "https://media.tenor.com/RbG_9Eh9KLoAAAAD/alien-alien-reveal.png",
        url,
        dims,
        size: 12,
    };

    return {
        gif: media,
        mediumgif: media,
        tinygif: media,
        nanogif: media,
        mp4: media,
        loopedmp4: media,
        tinymp4: media,
        nanomp4: media,
        webm: media,
        tinywebm: media,
        nanowebm: media,
    } as TenorGif["media"][number];
}

function tenorGif(overrides: Partial<TenorGif> = {}): TenorGif {
    return {
        created: 0,
        hasaudio: false,
        id: "12409989992265318124",
        media: [tenorMedia()],
        tags: ["alien"],
        title: "",
        itemurl: "https://tenor.com/bQ3Du.gif",
        hascaption: false,
        url: "https://tenor.com/view/alien-alien-reveal-gif-12409989992265318124",
        ...overrides,
    };
}

function createApp(dependencies: IntegrationsTenorSearchDependencies) {
    const app = express();
    app.use("/integrations/tenor/search", createIntegrationsTenorSearchRouter(dependencies));
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
        server.close();
    }
}

describe("GET /integrations/tenor/search", () => {
    test("documents the assigned manifest id and stays behind bearer auth", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/integrations/tenor/search/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/integrations/tenor/search?q=alien"), false);
    });

    test("builds a bounded Tenor GIF search URL", () => {
        const url = new URL(createTenorSearchUrl("alien & reveal", "api-key"));

        assert.equal(url.origin + url.pathname, "https://g.tenor.com/v1/search");
        assert.equal(url.searchParams.get("q"), "alien & reveal");
        assert.equal(url.searchParams.get("limit"), "10");
        assert.equal(url.searchParams.get("media_filter"), "gif");
        assert.equal(url.searchParams.get("key"), "api-key");
    });

    test("maps Tenor results to Discord's integration Tenor response shape", () => {
        assert.deepEqual(toIntegrationTenorGif(tenorGif()), {
            type: "gif",
            url: "https://tenor.com/bQ3Du.gif",
            src: "https://media.tenor.com/RbG_9Eh9KLoAAAAS/alien-alien-reveal.gif",
            width: 100,
            height: 90,
        });
    });

    test("proxies a search to Tenor and returns up to ten GIF objects", async () => {
        const fetchCalls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
        const fetchImpl: typeof fetch = async (input, init) => {
            fetchCalls.push({ input, init });
            return new Response(JSON.stringify({ results: [tenorGif()] }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        };

        const response = await requestJson(
            createApp({
                fetch: fetchImpl,
                getGifApiKey: () => "api-key",
            }),
            "/integrations/tenor/search?q=alien%20reveal",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [
            {
                type: "gif",
                url: "https://tenor.com/bQ3Du.gif",
                src: "https://media.tenor.com/RbG_9Eh9KLoAAAAS/alien-alien-reveal.gif",
                width: 100,
                height: 90,
            },
        ]);
        assert.equal(fetchCalls.length, 1);
        const upstreamUrl = new URL(String(fetchCalls[0].input));
        assert.equal(upstreamUrl.searchParams.get("q"), "alien reveal");
        assert.equal(upstreamUrl.searchParams.get("limit"), "10");
        assert.equal(upstreamUrl.searchParams.get("media_filter"), "gif");
        assert.equal(upstreamUrl.searchParams.get("key"), "api-key");
        assert.deepEqual(fetchCalls[0].init, {
            method: "get",
            headers: { "Content-Type": "application/json" },
        });
    });

    test("rejects requests without a search query before calling Tenor", async () => {
        let called = false;
        const response = await requestJson<{ code: number; message: string; errors: { q?: unknown } }>(
            createApp({
                fetch: (async () => {
                    called = true;
                    throw new Error("fetch should not be called");
                }) as typeof fetch,
                getGifApiKey: () => "api-key",
            }),
            "/integrations/tenor/search",
        );

        assert.equal(response.status, 400);
        assert.equal(response.body.code, 50035);
        assert.equal(response.body.message, "Invalid Form Body");
        assert.ok(response.body.errors.q);
        assert.equal(called, false);
    });
});
