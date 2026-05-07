import { describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";

const readProjectFile = (...parts: string[]) => readFile(path.join(process.cwd(), "src", ...parts), "utf8");
const readRoute = (routePath: string) => readProjectFile("cdn", "routes", routePath);

describe("attachment CDN mutation routes", () => {
    test("server-internal attachment mutations and uploads are not exposed on the public attachment route", async () => {
        const source = await readRoute("attachments.ts");

        assert.doesNotMatch(source, /router\.post\("\/:channel_id\/:message_id"/);
        assert.doesNotMatch(source, /router\.delete\("\/:channel_id\/:message_id\/:filename"/);
        assert.doesNotMatch(source, /router\.put\("\/:channel_id\/:batch_id\/:attachment_id\/:filename"/);
        assert.doesNotMatch(source, /router\.delete\("\/:channel_id\/:batch_id\/:attachment_id\/:filename"/);
        assert.doesNotMatch(source, /clone_to_message/);
        assert.doesNotMatch(source, /Invalid request signature/);
        assert.match(source, /router\.get\("\/:channel_id\/:message_id\/:filename"/);
    });

    test("all server-internal attachment mutations and uploads are exposed on the internal CDN route", async () => {
        const source = await readRoute(path.join("_spacebar", "cdn", "attachments.ts"));

        assert.match(source, /router\.put\("\/:channel_id\/:batch_id\/:attachment_id\/:filename"/);
        assert.match(source, /router\.post\("\/:channel_id\/:message_id"/);
        assert.match(source, /router\.delete\("\/:channel_id\/:message_id\/:filename"/);
        assert.match(source, /router\.delete\("\/:channel_id\/:batch_id\/:attachment_id\/:filename"/);
        assert.match(source, /router\.post\("\/:channel_id\/:batch_id\/:attachment_id\/:filename\/clone_to_message\/:message_id"/);
        assert.match(source, /requestSignature/);
    });

    test("server-side cloud attachment mutations use the internal CDN helper", async () => {
        const source = await Promise.all([readProjectFile("api", "routes", "channels", "#channel_id", "attachments.ts"), readProjectFile("api", "util", "handlers", "Message.ts")]);

        assert.doesNotMatch(source.join("\n"), /endpointPrivate[^`\n]*\/attachments/);
        assert.match(source.join("\n"), /getAttachmentMutationPath/);
        assert.match(source.join("\n"), /getAttachmentCloneMutationPath/);
    });
});
