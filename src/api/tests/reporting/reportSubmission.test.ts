process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar-test";
process.env.LOG_ROUTES = "false";

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import express from "express";
import { BodyParser, ErrorHandler } from "../../middlewares";
import reportingRouter from "../../routes/reporting";

interface JsonResponse {
    statusCode: number | undefined;
    body: unknown;
}

interface ErrorResponse {
    code: number;
    errors: Record<string, { _errors: { code: string }[] }>;
}

interface ReportingMenuResponseBody {
    name: string;
    success_node_id: number;
    nodes: Record<string, { button: { type: string } }>;
}

let server: http.Server;
let baseUrl: string;

const messageMenu = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "temp_report_menu_responses", "message.json"), "utf-8"));

function createMessageReportBody(overrides: Record<string, unknown> = {}) {
    return {
        version: messageMenu.version,
        variant: messageMenu.variant,
        name: "message",
        language: "en-US",
        breadcrumbs: [messageMenu.root_node_id],
        channel_id: "100000000000000001",
        message_id: "100000000000000002",
        ...overrides,
    };
}

function postJson(url: string, body: unknown): Promise<JsonResponse> {
    const payload = JSON.stringify(body);

    return new Promise((resolve, reject) => {
        const req = http.request(
            url,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "content-length": Buffer.byteLength(payload),
                },
            },
            (res) => {
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
            },
        );

        req.on("error", reject);
        req.end(payload);
    });
}

before(async () => {
    const app = express();
    app.use(BodyParser({ inflate: true, limit: "1mb" }));
    app.use("/reporting", reportingRouter);
    app.use(ErrorHandler);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            resolve();
        });
    });
    const address = server.address();
    assert(address && typeof address === "object");
    baseUrl = `http://${address.address}:${address.port}`;
});

after(async () => {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });
});

describe("report submissions", () => {
    test("returns the reporting menu response after a valid submission", async () => {
        const response = await postJson(`${baseUrl}/reporting/message`, createMessageReportBody());
        const body = response.body as ReportingMenuResponseBody;

        assert.equal(response.statusCode, 200);
        assert.equal(body.name, "message");
        assert.equal(body.success_node_id, messageMenu.success_node_id);
        assert.equal(body.nodes[String(messageMenu.success_node_id)].button.type, "done");
    });

    test("rejects submissions for a stale menu version", async () => {
        const response = await postJson(`${baseUrl}/reporting/message`, createMessageReportBody({ version: "stale" }));
        const body = response.body as ErrorResponse;

        assert.equal(response.statusCode, 400);
        assert.equal(body.code, 50035);
        assert.equal(body.errors.version._errors[0].code, "INVALID_REPORT_MENU_VERSION");
    });

    test("rejects breadcrumbs that are not reachable from the report menu root", async () => {
        const response = await postJson(`${baseUrl}/reporting/message`, createMessageReportBody({ breadcrumbs: [messageMenu.root_node_id, 74] }));
        const body = response.body as ErrorResponse;

        assert.equal(response.statusCode, 400);
        assert.equal(body.code, 50035);
        assert.equal(body.errors.breadcrumbs._errors[0].code, "INVALID_REPORT_MENU_BREADCRUMBS_PATH");
    });
});
