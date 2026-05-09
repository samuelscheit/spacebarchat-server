import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getWidgetPngCacheControl, getWidgetPngCacheRemainingSeconds, WidgetPngResponseCache } from "./WidgetPngCache";

describe("WidgetPngResponseCache", () => {
    test("reuses an unexpired render promise for the same guild/style key", async () => {
        const cache = new WidgetPngResponseCache(300_000);
        let renders = 0;
        const render = async () => {
            renders += 1;
            return Buffer.from(`render-${renders}`);
        };

        const first = cache.getOrCreate("guild-a:shield", render, 1_000);
        const second = cache.getOrCreate("guild-a:shield", render, 2_000);

        assert.equal(second.data, first.data);
        assert.equal(second.expiresAt, first.expiresAt);
        assert.equal((await second.data).toString(), "render-1");
        assert.equal(renders, 1);
    });

    test("keeps different guild/style combinations isolated", async () => {
        const cache = new WidgetPngResponseCache(300_000);
        let renders = 0;
        const render = async () => {
            renders += 1;
            return Buffer.from(`render-${renders}`);
        };

        const shield = cache.getOrCreate("guild-a:shield", render, 1_000);
        const banner = cache.getOrCreate("guild-a:banner1", render, 1_000);
        const otherGuild = cache.getOrCreate("guild-b:shield", render, 1_000);

        assert.equal((await shield.data).toString(), "render-1");
        assert.equal((await banner.data).toString(), "render-2");
        assert.equal((await otherGuild.data).toString(), "render-3");
        assert.equal(renders, 3);
    });

    test("refreshes expired entries", async () => {
        const cache = new WidgetPngResponseCache(100);
        let renders = 0;
        const render = async () => {
            renders += 1;
            return Buffer.from(`render-${renders}`);
        };

        const first = cache.getOrCreate("guild-a:shield", render, 1_000);
        assert.equal((await first.data).toString(), "render-1");

        const second = cache.getOrCreate("guild-a:shield", render, 1_101);

        assert.notEqual(second.data, first.data);
        assert.equal((await second.data).toString(), "render-2");
        assert.equal(second.expiresAt, 1_201);
        assert.equal(renders, 2);
    });

    test("keeps an expired in-flight render shared until it settles", async () => {
        const cache = new WidgetPngResponseCache(100);
        let renders = 0;
        let resolveRender!: (value: Buffer) => void;
        const render = () => {
            renders += 1;
            return new Promise<Buffer>((resolve) => {
                resolveRender = resolve;
            });
        };

        const first = cache.getOrCreate("guild-a:shield", render, 1_000);
        const second = cache.getOrCreate("guild-a:shield", render, 1_101);

        assert.equal(second.data, first.data);
        assert.equal(renders, 1);

        resolveRender(Buffer.from("render-1"));
        assert.equal((await second.data).toString(), "render-1");
    });

    test("prunes expired settled entries opportunistically", async () => {
        const cache = new WidgetPngResponseCache(100);
        const render = async () => Buffer.from("render");

        const first = cache.getOrCreate("guild-a:shield", render, 1_000);
        await first.data;

        assert.equal(cache.size, 1);

        const second = cache.getOrCreate("guild-b:shield", render, 1_101);
        await second.data;

        assert.equal(cache.size, 1);
    });

    test("evicts rejected renders so a later request can retry", async () => {
        const cache = new WidgetPngResponseCache(300_000);
        let renders = 0;
        const error = new Error("render failed");
        const render = async () => {
            renders += 1;
            if (renders === 1) throw error;
            return Buffer.from("render-2");
        };

        const first = cache.getOrCreate("guild-a:shield", render, 1_000);
        await assert.rejects(first.data, error);
        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });

        const second = cache.getOrCreate("guild-a:shield", render, 2_000);

        assert.notEqual(second.data, first.data);
        assert.equal((await second.data).toString(), "render-2");
        assert.equal(renders, 2);
    });

    test("evicts synchronous render failures so a later request can retry", async () => {
        const cache = new WidgetPngResponseCache(300_000);
        let renders = 0;
        const error = new Error("render failed");

        const first = cache.getOrCreate(
            "guild-a:shield",
            () => {
                renders += 1;
                throw error;
            },
            1_000,
        );
        await assert.rejects(first.data, error);
        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });

        const second = cache.getOrCreate(
            "guild-a:shield",
            async () => {
                renders += 1;
                return Buffer.from("render-2");
            },
            2_000,
        );

        assert.notEqual(second.data, first.data);
        assert.equal((await second.data).toString(), "render-2");
        assert.equal(renders, 2);
    });

    test("formats cache headers from the remaining entry lifetime", () => {
        assert.equal(getWidgetPngCacheRemainingSeconds(301_000, 1_000), 300);
        assert.equal(getWidgetPngCacheControl(301_000, 1_000), "public, max-age=300, s-maxage=300, immutable");
    });

    test("does not emit negative cache lifetimes for entries that expire while rendering", () => {
        assert.equal(getWidgetPngCacheRemainingSeconds(1_000, 1_001), 0);
        assert.equal(getWidgetPngCacheControl(1_000, 1_001), "public, max-age=0, s-maxage=0, immutable");
    });
});
