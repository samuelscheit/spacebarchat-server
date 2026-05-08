import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, it } from "node:test";

const execFileAsync = promisify(execFile);

const routeHarness = String.raw`
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

process.env.DATABASE ??= "postgres://user:pass@localhost:5432/test";
process.env.NODE_ENV = "test";
process.env.NODE_PATH = path.join(process.cwd(), "node_modules");
require("node:module").Module._initPaths();
require("module-alias/register");

const express = require("express");
const { Server } = require("lambert-server");

const calls = [];
global.__webhookExecuteHelpers = {
    executeWebhook: async (req, res) => {
        calls.push({ body: req.body, query: { ...req.query }, params: { ...req.params } });
        res.json({ ok: true, body: req.body, query: req.query });
    },
};

async function main() {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spacebar-webhook-slack-route-"));
    const tempRoutesRoot = path.join(tempRoot, "routes");
    const tempRouteDir = path.join(tempRoutesRoot, "webhooks", "#webhook_id", "#token");
    const tempHelperDir = path.join(tempRoot, "util", "handlers");
    fs.mkdirSync(tempRouteDir, { recursive: true });
    fs.mkdirSync(tempHelperDir, { recursive: true });
    fs.writeFileSync(path.join(tempHelperDir, "Webhook.js"), "module.exports = global.__webhookExecuteHelpers;\n");

    const sourceRouteFile = path.join(process.cwd(), "dist/api/routes/webhooks/#webhook_id/#token/slack.js");
    const sourceRoute = fs.readFileSync(sourceRouteFile, "utf8").replace(/\n\/\/# sourceMappingURL=.*\n?$/, "\n");
    fs.writeFileSync(path.join(tempRouteDir, "slack.js"), sourceRoute);

    const app = express();
    app.use(express.json());

    const server = new Server({ app, serverInitLogging: false });
    const routeFile = path.join(tempRoutesRoot, "webhooks", "#webhook_id", "#token", "slack.js");
    assert.ok(server.registerRoute(tempRoutesRoot, routeFile), "slack webhook route should register");

    const listener = app.listen(0);
    await new Promise((resolve) => listener.once("listening", resolve));
    const baseUrl = "http://127.0.0.1:" + listener.address().port;

    try {
        let response = await fetch(baseUrl + "/webhooks/webhook-token-id/secret-token/slack", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                text: "hello from slack",
                username: "Slack Bot",
                icon_url: "https://example.test/icon.png",
                channel: "#ignored-by-discord-compatible-webhooks",
                attachments: [
                    {
                        fallback: "fallback text",
                        color: "#36a64f",
                        pretext: "pretext",
                        author_name: "Author",
                        author_link: "https://example.test/author",
                        author_icon: "https://example.test/author.png",
                        title: "Attachment title",
                        title_link: "https://example.test/title",
                        text: "attachment text",
                        fields: [{ title: "Priority", value: "High", short: true }],
                        image_url: "https://example.test/image.png",
                        thumb_url: "https://example.test/thumb.png",
                        footer: "Footer",
                        footer_icon: "https://example.test/footer.png",
                        ts: "1700000000",
                    },
                ],
            }),
        });
        assert.equal(response.status, 200);
        let result = await response.json();
        assert.deepEqual(result.body, {
            content: "hello from slack",
            username: "Slack Bot",
            avatar_url: "https://example.test/icon.png",
            embeds: [
                {
                    type: "rich",
                    title: "Attachment title",
                    url: "https://example.test/title",
                    description: "pretext\n\nattachment text",
                    color: 0x36a64f,
                    timestamp: "2023-11-14T22:13:20.000Z",
                    author: {
                        name: "Author",
                        url: "https://example.test/author",
                        icon_url: "https://example.test/author.png",
                    },
                    image: { url: "https://example.test/image.png" },
                    thumbnail: { url: "https://example.test/thumb.png" },
                    footer: {
                        text: "Footer",
                        icon_url: "https://example.test/footer.png",
                    },
                    fields: [{ name: "Priority", value: "High", inline: true }],
                },
            ],
        });
        assert.deepEqual(calls[0].params, { webhook_id: "webhook-token-id", token: "secret-token" });
        assert.equal(calls[0].query.wait, "true");

        const slackPayload = JSON.stringify({ text: "form payload", attachments: [{ color: "good", fallback: "green" }] });
        response = await fetch(baseUrl + "/webhooks/webhook-token-id/secret-token/slack?wait=false", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ payload: slackPayload }).toString(),
        });
        assert.equal(response.status, 200);
        result = await response.json();
        assert.deepEqual(result.body, {
            content: "form payload",
            embeds: [
                {
                    type: "rich",
                    description: "green",
                    color: 0x2eb67d,
                },
            ],
        });
        assert.equal(calls[1].query.wait, "false");
    } finally {
        await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
`;

describe("Slack-compatible webhook route", () => {
    it("translates Slack JSON and form payloads before executing the webhook", async () => {
        const { NODE_V8_COVERAGE: _nodeV8Coverage, ...env } = process.env;
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spacebar-webhook-slack-route-harness-"));
        const harnessFile = path.join(tempRoot, "route-harness.js");
        fs.writeFileSync(harnessFile, routeHarness);

        try {
            const { stderr, stdout } = await execFileAsync(process.execPath, ["--enable-source-maps", harnessFile], {
                cwd: process.cwd(),
                env: {
                    ...env,
                    DATABASE: process.env.DATABASE ?? "postgres://user:pass@localhost:5432/test",
                },
                timeout: 10_000,
            });

            assert.equal(stdout, "");
            assert.equal(stderr, "");
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });
});
