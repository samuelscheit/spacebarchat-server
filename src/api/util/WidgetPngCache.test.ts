import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { WidgetPngResponseCache } from "./WidgetPngCache";

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
        const second = cache.getOrCreate("guild-a:shield", render, 1_101);

        assert.notEqual(second.data, first.data);
        assert.equal((await second.data).toString(), "render-2");
        assert.equal(second.expiresAt, 1_201);
        assert.equal(renders, 2);
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
});
