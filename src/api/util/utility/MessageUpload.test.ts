import assert from "node:assert/strict";
import { test } from "node:test";
import { Config, ConfigValue } from "@spacebar/util";
import { createMessageUpload, MESSAGE_UPLOAD_FIELD_LIMIT } from "./MessageUpload";

type InspectableMessageUpload = ReturnType<typeof createMessageUpload> & {
    limits?: {
        fields?: number;
        fileSize?: number;
    };
    storage?: {
        constructor?: {
            name?: string;
        };
    };
};

function inspectMessageUpload(upload: ReturnType<typeof createMessageUpload>) {
    return upload as InspectableMessageUpload;
}

test("createMessageUpload uses explicit message attachment size limits", () => {
    const upload = inspectMessageUpload(createMessageUpload({ maxAttachmentSize: 4096 }));

    assert.equal(upload.limits?.fileSize, 4096);
    assert.equal(upload.limits?.fields, MESSAGE_UPLOAD_FIELD_LIMIT);
    assert.equal(upload.storage?.constructor?.name, "MemoryStorage");
});

test("createMessageUpload reads the current configured message attachment size", (t) => {
    const config = new ConfigValue();
    config.limits.message.maxAttachmentSize = 2048;
    const getConfig = t.mock.method(Config, "get", () => config);

    const upload = inspectMessageUpload(createMessageUpload());

    assert.equal(getConfig.mock.callCount(), 1);
    assert.equal(upload.limits?.fileSize, 2048);
    assert.equal(upload.limits?.fields, MESSAGE_UPLOAD_FIELD_LIMIT);
});
