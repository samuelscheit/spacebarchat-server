/* global FormData */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
    buildCdnAttachmentMigrationRequest,
    buildUpdateConfigurationRequest,
    buildUserDeletionRequest,
    submitActionRequest,
} from "./action-requests.mjs";

function form(entries) {
    const formData = new FormData();
    for (const [key, value] of entries) formData.set(key, value);
    return formData;
}

describe("admin dashboard action requests", () => {
    test("builds dangerous user deletion requests with reason and idempotency", () => {
        const request = buildUserDeletionRequest(
            form([
                ["userId", "200"],
                ["deleteMessages", "on"],
                ["reason", "policy removal"],
                ["confirmation", "200"],
            ]),
            () => "generated-key",
        );

        assert.equal(request.path, "/users/200/delete");
        assert.equal(request.init.method, "POST");
        assert.deepEqual(JSON.parse(request.init.body), {
            deleteMessages: true,
            reason: "policy removal",
            confirmation: "200",
        });
        assert.deepEqual(request.init.headers, { "idempotency-key": "generated-key" });
    });

    test("builds safe CDN dry-run migration requests intentionally", () => {
        const request = buildCdnAttachmentMigrationRequest(
            form([
                ["dryRun", "on"],
                ["missingLimit", "25"],
                ["reason", "verify paths"],
                ["confirmation", "MIGRATE ATTACHMENTS"],
                ["idempotencyKey", "existing-key"],
            ]),
            () => "unused",
        );

        assert.equal(request.path, "/media/attachments/migrate");
        assert.deepEqual(JSON.parse(request.init.body), {
            dryRun: true,
            force: false,
            missingLimit: 25,
            reason: "verify paths",
            confirmation: "MIGRATE ATTACHMENTS",
        });
        assert.deepEqual(request.init.headers, { "idempotency-key": "existing-key" });
    });

    test("propagates admin API mutation failures", async () => {
        const request = buildUpdateConfigurationRequest(
            form([
                ["configuration", "{\"features\":{\"ok\":true}}"],
                ["reason", "test failure"],
                ["confirmation", "SAVE CONFIGURATION"],
            ]),
        );
        const failure = new Error("mutation rejected");

        await assert.rejects(
            submitActionRequest(request, async () => {
                throw failure;
            }),
            failure,
        );
    });
});
