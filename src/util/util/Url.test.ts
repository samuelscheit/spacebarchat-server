import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseHttpRequestUrl } from "./Url";

describe("HTTP request URL parsing", () => {
    test("parses relative request targets against a fixed base", () => {
        const parsed = parseHttpRequestUrl("/-/metrics?x=1");

        assert.equal(parsed.pathname, "/-/metrics");
        assert.equal(parsed.searchParams.get("x"), "1");
    });

    test("parses absolute-form request targets", () => {
        const parsed = parseHttpRequestUrl("http://example.test/-/metrics?x=1");

        assert.equal(parsed.pathname, "/-/metrics");
        assert.equal(parsed.searchParams.get("x"), "1");
    });

    test("falls back to the root path for malformed absolute-form request targets", () => {
        const parsed = parseHttpRequestUrl("http://[::1");

        assert.equal(parsed.pathname, "/");
    });

    test("falls back to the root path for malformed network-path request targets", () => {
        const parsed = parseHttpRequestUrl("//[::1");

        assert.equal(parsed.pathname, "/");
    });
});
