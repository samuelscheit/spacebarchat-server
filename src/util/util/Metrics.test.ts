import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { collectPrometheusMetrics, formatPrometheusMetrics, getProcessMetricSamples } from "./Metrics";

describe("Prometheus metrics", () => {
    test("formats samples with metadata once per metric", () => {
        const output = formatPrometheusMetrics([
            {
                name: "spacebar_test_value",
                help: "A test value.",
                type: "gauge",
                value: 1,
                labels: { service: "api" },
            },
            {
                name: "spacebar_test_value",
                help: "A test value.",
                type: "gauge",
                value: 2,
                labels: { service: "gateway" },
            },
        ]);

        assert.equal(output.match(/# HELP spacebar_test_value/g)?.length, 1);
        assert.match(output, /spacebar_test_value\{service="api"\} 1/);
        assert.match(output, /spacebar_test_value\{service="gateway"\} 2/);
        assert.equal(output.endsWith("\n"), true);
    });

    test("escapes label values", () => {
        const output = formatPrometheusMetrics([
            {
                name: "spacebar_test_value",
                help: "A test value.",
                type: "gauge",
                value: 1,
                labels: { service: 'api"quoted\\line\nbreak' },
            },
        ]);

        assert.match(output, /service="api\\"quoted\\\\line\\nbreak"/);
    });

    test("drops non-finite samples", () => {
        const output = formatPrometheusMetrics([
            { name: "spacebar_test_value", help: "A test value.", type: "gauge", value: Number.NaN },
            { name: "spacebar_test_value", help: "A test value.", type: "gauge", value: 3 },
        ]);

        assert.match(output, /spacebar_test_value 3/);
        assert.doesNotMatch(output, /NaN/);
    });

    test("collects process metrics and extras", () => {
        const samples = getProcessMetricSamples("api", [{ name: "spacebar_extra", help: "Extra metric.", type: "gauge", value: 4 }]);
        const names = new Set(samples.map((sample) => sample.name));

        assert.equal(names.has("spacebar_process_uptime_seconds"), true);
        assert.equal(names.has("spacebar_process_memory_bytes"), true);
        assert.equal(names.has("spacebar_extra"), true);

        const output = collectPrometheusMetrics("api");
        assert.match(output, /spacebar_process_uptime_seconds\{service="api"\} /);
    });
});
