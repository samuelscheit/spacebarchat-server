import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import { afterEach, test } from "node:test";
import express from "express";
import trendingRouter from "../../src/api/routes/gifs/trending";

const originalFetch = globalThis.fetch;

type TrendingResponseBody = {
    gifs: { src: string; gif_src: string }[];
};

function createTenorGif() {
    return {
        created: 0,
        hasaudio: false,
        id: "gif-id",
        media: [
            {
                gif: {
                    preview: "https://media.example/gif-preview.gif",
                    url: "https://media.example/source.gif",
                    dims: [320, 240],
                    size: 4096,
                },
                mp4: {
                    preview: "https://media.example/mp4-preview.png",
                    url: "https://media.example/source.mp4",
                    dims: [320, 240],
                    size: 1024,
                },
            },
        ],
        tags: [],
        title: "gif title",
        itemurl: "https://tenor.example/view/gif-id",
        hascaption: false,
        url: "https://tenor.example/gif-id",
    };
}

afterEach(() => {
    globalThis.fetch = originalFetch;
});

async function requestTrending() {
    const requestedUrls: string[] = [];
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        requestedUrls.push(url);

        if (url.includes("/categories")) {
            return Response.json({ tags: [{ searchterm: "cats", path: "cats", image: "https://media.example/cats.png", name: "Cats" }] });
        }

        if (url.includes("/trending")) {
            return Response.json({ next: "", results: [createTenorGif()], locale: "en-US" });
        }

        throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch;

    const app = express();
    app.use("/gifs/trending", trendingRouter);

    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await originalFetch(`http://127.0.0.1:${address.port}/gifs/trending?locale=en-US`);
        const body = (await response.json()) as TrendingResponseBody;

        assert.equal(response.status, 200);
        assert.equal(body.gifs[0].src, "https://media.example/source.mp4");
        assert.equal(body.gifs[0].gif_src, "https://media.example/source.gif");

        const trendingUrl = requestedUrls.find((url) => url.includes("/trending"));
        assert.ok(trendingUrl);
        return new URL(trendingUrl);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

test("trending requests Tenor's mp4 and gif media set by default", async () => {
    const trendingUrl = await requestTrending();

    assert.equal(trendingUrl.searchParams.get("media_filter"), "basic");
});
