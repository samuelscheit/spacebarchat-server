process.env.LOG_ROUTES = "false";

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import express from "express";
import reportingRouter, { validateCreateReport } from "../../routes/reporting/index";
import { CreateReportSchema, ReportingMenuResponse } from "@spacebar/schemas";
import { ErrorHandler } from "../../middlewares";

function readMenu(type: string): ReportingMenuResponse {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "temp_report_menu_responses", `${type}.json`), "utf-8")) as ReportingMenuResponse;
}

function createValidMessageReport(): CreateReportSchema {
    const menu = readMenu("message");

    return {
        name: "message",
        version: menu.version,
        variant: menu.variant,
        language: "en-US",
        breadcrumbs: [menu.root_node_id, 98],
        channel_id: "channel-id",
        message_id: "message-id",
    };
}

function createValidGuildReport(): CreateReportSchema {
    const menu = readMenu("guild");

    return {
        name: "guild",
        version: menu.version,
        variant: menu.variant,
        language: "en-US",
        breadcrumbs: [menu.root_node_id, 3, 2, 98],
        guild_id: "guild-id",
        elements: {
            guild_select: ["name"],
        },
    };
}

function assertFieldError(fn: () => void, field: string, code: string) {
    assert.throws(fn, (error) => {
        const fieldError = error as { errors?: Record<string, { _errors?: { code: string }[] }> };
        assert.equal(fieldError.errors?.[field]?._errors?.[0]?.code, code);
        return true;
    });
}

async function postMessageReport(body: CreateReportSchema) {
    const app = express();
    app.use(express.json());
    app.use("/", reportingRouter);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}/message`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });

        return {
            response,
            body: await response.text(),
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

async function getReportingMenu(pathname: string) {
    const app = express();
    app.use("/", reportingRouter);
    app.use(ErrorHandler);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
        const text = await response.text();

        return {
            response,
            body: text ? (JSON.parse(text) as unknown) : null,
            text,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /reporting/menu/:type", () => {
    test("returns the requested report menu from the parameterized route", async () => {
        const expectedMenu = readMenu("message");
        const { response, body } = await getReportingMenu("/menu/message");

        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/);
        assert.deepEqual(body, expectedMenu);
    });

    test("returns no content when the requested variant is unavailable", async () => {
        const { response, text } = await getReportingMenu("/menu/message?variant=missing");

        assert.equal(response.status, 204);
        assert.equal(text, "");
    });

    test("rejects unknown report menu types before building a file path", async () => {
        const { response, body } = await getReportingMenu("/menu/not_a_report_type");

        assert.equal(response.status, 400);
        assert.equal((body as { code?: number }).code, 400);
        assert.match((body as { message?: string }).message ?? "", /Unknown report menu type/);
    });

    test("rejects non-string variant query values", async () => {
        const { response, body } = await getReportingMenu("/menu/message?variant=1&variant=2");

        assert.equal(response.status, 400);
        assert.equal((body as { code?: number }).code, 50035);
        assert.equal((body as { errors?: Record<string, { _errors?: { code: string }[] }> }).errors?.variant?._errors?.[0]?.code, "BASE_TYPE_REQUIRED");
    });
});

describe("validateCreateReport", () => {
    test("accepts a report payload matching the served menu", () => {
        assert.doesNotThrow(() => validateCreateReport("message", createValidMessageReport()));
    });

    test("responds 204 after accepting a valid report payload", async () => {
        const { response, body } = await postMessageReport(createValidMessageReport());

        assert.equal(response.status, 204);
        assert.equal(body, "");
    });

    test("rejects reports submitted against a stale menu version", () => {
        assertFieldError(
            () =>
                validateCreateReport("message", {
                    ...createValidMessageReport(),
                    version: "stale-version",
                }),
            "version",
            "INVALID_REPORT_MENU_VERSION",
        );
    });

    test("rejects breadcrumbs that do not start at the menu root", () => {
        const menu = readMenu("message");
        const nonRootNodeId = Number(Object.keys(menu.nodes).find((nodeId) => Number(nodeId) !== menu.root_node_id));

        assertFieldError(
            () =>
                validateCreateReport("message", {
                    ...createValidMessageReport(),
                    breadcrumbs: [nonRootNodeId],
                }),
            "breadcrumbs",
            "INVALID_REPORT_MENU_BREADCRUMBS_PATH",
        );
    });

    test("rejects breadcrumbs that stop before a submittable node", () => {
        const menu = readMenu("message");

        assertFieldError(
            () =>
                validateCreateReport("message", {
                    ...createValidMessageReport(),
                    breadcrumbs: [menu.root_node_id],
                }),
            "breadcrumbs",
            "INVALID_REPORT_MENU_BREADCRUMBS_TERMINAL",
        );
    });

    test("accepts button-target breadcrumb transitions with required element data", () => {
        assert.doesNotThrow(() => validateCreateReport("guild", createValidGuildReport()));
    });

    test("requires submitted data for required report menu elements", () => {
        const { elements: _elements, ...reportWithoutElements } = createValidGuildReport();

        assertFieldError(() => validateCreateReport("guild", reportWithoutElements), "elements.guild_select", "MISSING_REQUIRED_REPORT_ELEMENT");
    });

    test("rejects submitted values outside the report menu element options", () => {
        assertFieldError(
            () =>
                validateCreateReport("guild", {
                    ...createValidGuildReport(),
                    elements: {
                        guild_select: ["not-a-menu-option"],
                    },
                }),
            "elements.guild_select",
            "INVALID_REPORT_ELEMENT_VALUE",
        );
    });

    test("requires fields specific to the report type", () => {
        const { message_id: _messageId, ...reportWithoutMessageId } = createValidMessageReport();

        assertFieldError(() => validateCreateReport("message", reportWithoutMessageId), "message_id", "MISSING_FIELD");
    });
});
