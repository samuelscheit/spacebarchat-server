import assert from "node:assert/strict";
import { test } from "node:test";
import { createReadyConsents } from "./ReadyConsents";

test("READY consents default personalization to not consented", () => {
    assert.deepEqual(createReadyConsents(), {
        personalization: {
            consented: false,
        },
    });
});

test("READY consents are returned as fresh objects", () => {
    const first = createReadyConsents();
    const second = createReadyConsents();

    assert.notEqual(first, second);
    assert.notEqual(first.personalization, second.personalization);
});
