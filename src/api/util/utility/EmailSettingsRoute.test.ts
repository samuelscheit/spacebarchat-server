import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import express from "express";
import emailSettingsRouter, { DefaultEmailSettingsResponse } from "../../routes/users/@me/email-settings";

async function createEmailSettingsApp() {
    const app = express();
    app.use("/users/@me/email-settings", emailSettingsRouter);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert(address && typeof address === "object");

    return {
        server,
        url: `http://${address.address}:${address.port}/users/@me/email-settings`,
    };
}

function getJson(url: string): Promise<{ statusCode: number | undefined; body: unknown }> {
    return new Promise((resolve, reject) => {
        const req = http.request(url, { method: "GET" }, (res) => {
            let data = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        body: data ? JSON.parse(data) : null,
                    });
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on("error", reject);
        req.end();
    });
}

describe("GET /users/@me/email-settings", () => {
    test("returns the documented compatibility defaults", async () => {
        const { server, url } = await createEmailSettingsApp();
        try {
            const response = await getJson(url);

            assert.equal(response.statusCode, 200);
            assert.deepEqual(response.body, DefaultEmailSettingsResponse);
        } finally {
            await new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            });
        }
    });

    test("does not retain the empty TODO inventory marker", async () => {
        const source = await readFile("src/api/routes/users/@me/email-settings.ts", "utf8");

        assert.doesNotMatch(source, /TODO:\s*$/m);
    });
});
