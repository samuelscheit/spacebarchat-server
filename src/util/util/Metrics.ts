export type MetricType = "counter" | "gauge";

export type MetricSample = {
    name: string;
    help: string;
    type: MetricType;
    value: number;
    labels?: Record<string, string | number | boolean>;
};

export const PROMETHEUS_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";

function escapeLabelValue(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

function formatLabels(labels?: Record<string, string | number | boolean>) {
    if (!labels || Object.keys(labels).length === 0) return "";

    const formattedLabels = Object.entries(labels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}="${escapeLabelValue(String(value))}"`)
        .join(",");

    return `{${formattedLabels}}`;
}

export function formatPrometheusMetrics(samples: MetricSample[]) {
    const emittedMetadata = new Set<string>();
    const lines: string[] = [];

    for (const sample of samples) {
        if (!Number.isFinite(sample.value)) continue;

        if (!emittedMetadata.has(sample.name)) {
            emittedMetadata.add(sample.name);
            lines.push(`# HELP ${sample.name} ${sample.help}`);
            lines.push(`# TYPE ${sample.name} ${sample.type}`);
        }

        lines.push(`${sample.name}${formatLabels(sample.labels)} ${sample.value}`);
    }

    return `${lines.join("\n")}\n`;
}

export function getProcessMetricSamples(service: string, extraSamples: MetricSample[] = []): MetricSample[] {
    const serviceLabel = { service };
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();

    return [
        {
            name: "spacebar_process_uptime_seconds",
            help: "Process uptime in seconds.",
            type: "gauge",
            value: process.uptime(),
            labels: serviceLabel,
        },
        {
            name: "spacebar_process_start_time_seconds",
            help: "Unix timestamp when the process started.",
            type: "gauge",
            value: Date.now() / 1000 - process.uptime(),
            labels: serviceLabel,
        },
        ...Object.entries(memory).map(([kind, value]) => ({
            name: "spacebar_process_memory_bytes",
            help: "Process memory usage in bytes.",
            type: "gauge" as const,
            value,
            labels: { ...serviceLabel, kind },
        })),
        {
            name: "spacebar_process_cpu_user_seconds_total",
            help: "Total user CPU time used by the process in seconds.",
            type: "counter",
            value: cpu.user / 1_000_000,
            labels: serviceLabel,
        },
        {
            name: "spacebar_process_cpu_system_seconds_total",
            help: "Total system CPU time used by the process in seconds.",
            type: "counter",
            value: cpu.system / 1_000_000,
            labels: serviceLabel,
        },
        ...extraSamples,
    ];
}

export function collectPrometheusMetrics(service: string, extraSamples: MetricSample[] = []) {
    return formatPrometheusMetrics(getProcessMetricSamples(service, extraSamples));
}
