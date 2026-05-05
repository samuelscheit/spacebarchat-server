import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const readRoute = (routePath: string) => readFile(path.join(process.cwd(), "src", "cdn", "routes", routePath), "utf8");

describe("attachment CDN mutation routes", () => {
    test("classic attachment upload and delete are not exposed on the public attachment route", async () => {
        const source = await readRoute("attachments.ts");

        assert.doesNotMatch(source, /router\.post\("\/:channel_id\/:message_id"/);
        assert.doesNotMatch(source, /router\.delete\("\/:channel_id\/:message_id\/:filename"/);
    });

    test("classic attachment upload and delete are exposed on the internal CDN route", async () => {
        const source = await readRoute(path.join("_spacebar", "cdn", "attachments.ts"));

        assert.match(source, /router\.post\("\/:channel_id\/:message_id"/);
        assert.match(source, /router\.delete\("\/:channel_id\/:message_id\/:filename"/);
    });
});
