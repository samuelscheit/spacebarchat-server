import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { validateSchema } from "./Validator";

const PngDataUri = "data:image/png;base64,iVBORw0KGgo=";

describe("schema validator custom formats", () => {
    test("accepts image data URI fields with matching image bytes", () => {
        assert.deepEqual(validateSchema("WebhookCreateSchema", { name: "hook", avatar: PngDataUri }), { name: "hook", avatar: PngDataUri });
    });

    test("rejects image data URI fields with mismatched image bytes", () => {
        assert.throws(() => validateSchema("WebhookCreateSchema", { name: "hook", avatar: "data:image/png;base64,/9j/" }));
    });
});
