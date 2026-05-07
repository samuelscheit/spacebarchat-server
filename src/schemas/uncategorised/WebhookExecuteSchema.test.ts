import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";

const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, unknown>;
const webhookExecuteSchema = {
    ...(schemas.WebhookExecuteSchema as Record<string, unknown>),
    definitions: schemas,
};

function compileWebhookExecuteSchema() {
    return new Ajv({ strict: false, validateFormats: false }).compile(webhookExecuteSchema);
}

describe("WebhookExecuteSchema", () => {
    test("accepts message and cloud attachment descriptors", () => {
        const validate = compileWebhookExecuteSchema();

        assert.equal(
            validate({
                content: "with attachments",
                attachments: [
                    {
                        id: "0",
                        filename: "plain.txt",
                    },
                    {
                        filename: "image.png",
                        uploaded_filename: "attachments/100000000000000001/1/image.png",
                    },
                ],
            }),
            true,
            JSON.stringify(validate.errors),
        );
    });

    test("rejects arbitrary attachment objects", () => {
        const validate = compileWebhookExecuteSchema();

        assert.equal(
            validate({
                content: "bad attachment",
                attachments: [{ filename: "missing-uploaded-id.png" }],
            }),
            false,
        );
    });
});
