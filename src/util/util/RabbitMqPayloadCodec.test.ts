import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { decodeRabbitMqPayload, encodeRabbitMqPayload, normalizeRabbitMqContentType, RabbitMqBinaryContentType, RabbitMqJsonContentType } from "./RabbitMqPayloadCodec";

describe("RabbitMqPayloadCodec", () => {
    test("encodes structured payloads as JSON", () => {
        const encoded = encodeRabbitMqPayload({ event_name: "READY", count: 2 });

        assert.equal(encoded.contentType, RabbitMqJsonContentType);
        assert.equal(encoded.body.toString("utf8"), '{"event_name":"READY","count":2}');
    });

    test("encodes strings and null-like payloads as JSON", () => {
        const encodedString = encodeRabbitMqPayload("payload");
        const encodedNull = encodeRabbitMqPayload(null);
        const encodedUndefined = encodeRabbitMqPayload(undefined);

        assert.equal(encodedString.contentType, RabbitMqJsonContentType);
        assert.equal(encodedString.body.toString("utf8"), '"payload"');
        assert.equal(encodedNull.body.toString("utf8"), "null");
        assert.equal(encodedUndefined.body.toString("utf8"), "null");
    });

    test("encodes buffers and byte array views as raw binary", () => {
        const buffer = Buffer.from([0, 1, 2, 255]);
        const array = new Uint8Array([9, 8, 7, 6]);
        const view = new DataView(array.buffer, 1, 2);

        const encodedBuffer = encodeRabbitMqPayload(buffer);
        const encodedArray = encodeRabbitMqPayload(array.subarray(1, 3));
        const encodedView = encodeRabbitMqPayload(view);

        assert.equal(encodedBuffer.contentType, RabbitMqBinaryContentType);
        assert.deepEqual([...encodedBuffer.body], [0, 1, 2, 255]);
        assert.equal(encodedArray.contentType, RabbitMqBinaryContentType);
        assert.deepEqual([...encodedArray.body], [8, 7]);
        assert.equal(encodedView.contentType, RabbitMqBinaryContentType);
        assert.deepEqual([...encodedView.body], [8, 7]);
    });

    test("decodes JSON payloads and legacy payloads without content type", () => {
        assert.deepEqual(decodeRabbitMqPayload(Buffer.from('{"hello":"world"}', "utf8"), RabbitMqJsonContentType), { hello: "world" });
        assert.equal(decodeRabbitMqPayload(Buffer.from('"payload"', "utf8"), "application/json; charset=utf-8"), "payload");
        assert.deepEqual(decodeRabbitMqPayload(Buffer.from("[1,2,3]", "utf8")), [1, 2, 3]);
    });

    test("decodes structured JSON suffix content types", () => {
        assert.deepEqual(decodeRabbitMqPayload(Buffer.from('{"ok":true}', "utf8"), "application/vnd.spacebar.event+json"), { ok: true });
    });

    test("decodes binary payloads without JSON parsing", () => {
        const payload = Buffer.from([0, 1, 2, 255]);
        const decoded = decodeRabbitMqPayload(payload, RabbitMqBinaryContentType);

        assert(Buffer.isBuffer(decoded));
        assert.deepEqual([...decoded], [0, 1, 2, 255]);
    });

    test("returns unknown content types as raw bytes", () => {
        const payload = Buffer.from([1, 2, 3]);
        const decoded = decodeRabbitMqPayload(payload, "application/x-spacebar-binary");

        assert(Buffer.isBuffer(decoded));
        assert.deepEqual([...decoded], [1, 2, 3]);
    });

    test("normalizes content type parameters and casing", () => {
        assert.equal(normalizeRabbitMqContentType(" Application/JSON; Charset=UTF-8 "), RabbitMqJsonContentType);
        assert.equal(normalizeRabbitMqContentType(" APPLICATION/OCTET-STREAM "), RabbitMqBinaryContentType);
        assert.equal(normalizeRabbitMqContentType(null), undefined);
        assert.equal(normalizeRabbitMqContentType(undefined), undefined);
    });
});
