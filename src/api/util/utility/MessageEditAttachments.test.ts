import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { MessageCreateCloudAttachment } from "@spacebar/schemas";
import type { Attachment } from "@spacebar/util";
import { type MessageEditAttachmentRequest, normalizeMessageEditBodyAttachments, resolveMessageEditAttachments } from "./MessageEditAttachments";

function attachment(id: string): Attachment {
    return { id, filename: `${id}.txt` } as Attachment;
}

function assertUnknownAttachment(fn: () => unknown): void {
    let error: unknown;
    try {
        fn();
    } catch (caught) {
        error = caught;
    }

    assert.ok(error instanceof Error);
    assert.equal((error as Error).message, "Unknown attachment");
    assert.equal((error as { code?: number }).code, 400);
}

describe("message edit attachment normalization", () => {
    test("returns undefined for omitted attachment edits so callers preserve existing message attachments", () => {
        assert.equal(resolveMessageEditAttachments([attachment("existing")], undefined), undefined);

        const normalized = normalizeMessageEditBodyAttachments({ content: "after" }, [attachment("existing")]);
        assert.deepEqual(normalized, { content: "after" });
        assert.equal(Object.hasOwn(normalized, "attachments"), false);
    });

    test("clears attachments for explicit empty or null attachment edits", () => {
        assert.deepEqual(resolveMessageEditAttachments([attachment("existing")], []), []);
        assert.deepEqual(resolveMessageEditAttachments([attachment("existing")], null), []);

        assert.deepEqual(normalizeMessageEditBodyAttachments({ content: "after", attachments: [] }, [attachment("existing")]), {
            content: "after",
            attachments: [],
        });
        assert.deepEqual(normalizeMessageEditBodyAttachments({ content: "after", attachments: null }, [attachment("existing")]), {
            content: "after",
            attachments: [],
        });
    });

    test("retains requested existing attachments and passes through new cloud attachments", () => {
        const existing = attachment("existing");
        const cloudAttachment: MessageCreateCloudAttachment = {
            filename: "new.txt",
            uploaded_filename: "channel/upload/new.txt",
        };

        const resolved = resolveMessageEditAttachments([existing], [{ id: "existing" }, cloudAttachment]);

        assert.equal(resolved?.[0], existing);
        assert.equal(resolved?.[1], cloudAttachment);
    });

    test("rejects retained attachment references without a matching existing attachment", () => {
        assertUnknownAttachment(() => resolveMessageEditAttachments([attachment("existing")], [{ id: "missing" }]));
        assertUnknownAttachment(() => resolveMessageEditAttachments([attachment("existing")], [{ filename: "missing-id.txt" } as unknown as MessageEditAttachmentRequest]));
    });
});
