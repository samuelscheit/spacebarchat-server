process.env.LOG_ROUTES = "false";

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateCreateReport } from "../../routes/reporting/index";
import { CreateReportSchema, ReportingMenuResponse } from "@spacebar/schemas";

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
        breadcrumbs: [menu.root_node_id],
        channel_id: "channel-id",
        message_id: "message-id",
    };
}

function assertFieldError(fn: () => void, field: string, code: string) {
    assert.throws(fn, (error) => {
        const fieldError = error as { errors?: Record<string, { _errors?: { code: string }[] }> };
        assert.equal(fieldError.errors?.[field]?._errors?.[0]?.code, code);
        return true;
    });
}

describe("validateCreateReport", () => {
    test("accepts a report payload matching the served menu", () => {
        assert.doesNotThrow(() => validateCreateReport("message", createValidMessageReport()));
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

    test("requires fields specific to the report type", () => {
        const { message_id: _messageId, ...reportWithoutMessageId } = createValidMessageReport();

        assertFieldError(() => validateCreateReport("message", reportWithoutMessageId), "message_id", "MISSING_FIELD");
    });
});
