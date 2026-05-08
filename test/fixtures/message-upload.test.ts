import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { afterEach, describe, test } from "node:test";
import express, { type NextFunction, type Request, type Response } from "express";
import { createMessageUpload } from "@spacebar/api";
import { Config } from "@spacebar/util";

const restoreCallbacks: Array<() => void> = [];

afterEach(() => {
    while (restoreCallbacks.length) restoreCallbacks.pop()?.();
});

function stubMessageAttachmentLimit(maxAttachmentSize: number) {
    const original = Config.get;
    Config.get = (() => ({
        limits: {
            message: {
                maxAttachmentSize,
            },
        },
    })) as typeof Config.get;

    restoreCallbacks.push(() => {
        Config.get = original;
    });
}

async function startUploadServer() {
    const app = express();
    const upload = createMessageUpload();
    let uploadHandlerReached = false;

    app.use((_req, _res, next) => {
        uploadHandlerReached = false;
        next();
    });

    app.post("/upload", upload.any(), (req, res) => {
        uploadHandlerReached = true;
        const files = ((req.files as Express.Multer.File[] | undefined) ?? []).map((file) => ({
            fieldname: file.fieldname,
            originalname: file.originalname,
            size: file.size,
            body: file.buffer.toString("utf8"),
        }));

        res.json({ files, uploadHandlerReached });
    });

    app.use((error: Error & { code?: string }, _req: Request, res: Response, _next: NextFunction) => {
        res.status(400).json({
            name: error.name,
            code: error.code,
            message: error.message,
            uploadHandlerReached,
        });
    });

    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert(address && typeof address === "object");

    return {
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            }),
        url: `http://${address.address}:${address.port}/upload`,
    };
}

async function postMultipartFile(url: string, body: string) {
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ content: "with upload" }));
    form.append("files[0]", new Blob([body], { type: "text/plain" }), "upload.txt");

    return await fetch(url, {
        method: "POST",
        body: form,
    });
}

describe("message upload middleware", () => {
    test("uses the configured message attachment limit for multipart uploads", async () => {
        stubMessageAttachmentLimit(5);
        const server = await startUploadServer();

        try {
            const accepted = await postMultipartFile(server.url, "1234");
            assert.equal(accepted.status, 200);
            assert.deepEqual(await accepted.json(), {
                files: [
                    {
                        fieldname: "files[0]",
                        originalname: "upload.txt",
                        size: 4,
                        body: "1234",
                    },
                ],
                uploadHandlerReached: true,
            });

            const rejected = await postMultipartFile(server.url, "123456");
            assert.equal(rejected.status, 400);
            assert.deepEqual(await rejected.json(), {
                name: "MulterError",
                code: "LIMIT_FILE_SIZE",
                message: "File too large",
                uploadHandlerReached: false,
            });
        } finally {
            await server.close();
        }
    });

    test("message routes share the config-driven upload middleware", () => {
        const routeFiles = [
            "src/api/routes/channels/#channel_id/messages/index.ts",
            "src/api/routes/channels/#channel_id/messages/#message_id/index.ts",
            "src/api/routes/webhooks/#webhook_id/#token/index.ts",
            "src/api/routes/webhooks/#webhook_id/#token/messages/#message_id/index.ts",
        ];

        for (const routeFile of routeFiles) {
            const source = readFileSync(routeFile, "utf8");

            assert.match(source, /\bcreateMessageUpload\(/, `${routeFile} should use the shared message upload middleware`);
            assert.doesNotMatch(source, /TODO: config max upload size|max upload 50 mb/, `${routeFile} should not keep stale max-upload comments`);
            assert.doesNotMatch(source, /\bmulter\s*\(/, `${routeFile} should not duplicate multer upload configuration`);
            assert.doesNotMatch(source, /fileSize:\s*1024\s*\*\s*1024\s*\*\s*100/, `${routeFile} should not hard-code a message upload byte limit`);
        }
    });
});
