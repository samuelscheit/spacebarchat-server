import { createWriteStream, WriteStream } from "node:fs";
import path from "node:path";
import { finished } from "node:stream/promises";

import { FixtureManifest } from "../fixtures/manifest.js";
import { scanForSecrets } from "../processors/redact.js";
import { CaptureEvent } from "../types.js";
import { ensureDir } from "../util/fs.js";
import { stableStringify } from "../util/json.js";

export interface EventWriterOptions {
    filePath: string;
    fixtures?: FixtureManifest;
    failOnSecret?: boolean;
}

export class NdjsonEventWriter {
    private readonly stream: WriteStream;
    private readonly failOnSecret: boolean;

    private constructor(options: EventWriterOptions) {
        this.stream = createWriteStream(options.filePath, { encoding: "utf8", flags: "a" });
        this.failOnSecret = options.failOnSecret ?? true;
    }

    static async open(options: EventWriterOptions): Promise<NdjsonEventWriter> {
        await ensureDir(path.dirname(options.filePath));
        return new NdjsonEventWriter(options);
    }

    async write(event: CaptureEvent): Promise<void> {
        if (this.failOnSecret) {
            const actionViolations = uiActionRedactionViolations(event);
            if (actionViolations.length > 0) {
                throw new Error(`Refusing to write unsafe ui.action event: ${actionViolations.join(", ")}`);
            }
            const scan = scanForSecrets(event);
            if (!scan.ok) {
                throw new Error(`Refusing to write ${event.kind} event with possible unredacted secret: ${scan.violations.join(", ")}`);
            }
        }

        await new Promise<void>((resolve, reject) => {
            this.stream.write(`${stableStringify(event)}\n`, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    async close(): Promise<void> {
        this.stream.end();
        await finished(this.stream);
    }
}

function uiActionRedactionViolations(event: CaptureEvent): string[] {
    if (event.kind !== "ui.action") {
        return [];
    }

    const violations: string[] = [];
    if ((event.action === "fill" || event.action === "type" || event.action === "set-input-files") && event.value_redacted !== true) {
        violations.push(`${event.action}:value_redacted_required`);
    }
    if ((event.action === "click" || event.action === "context-click") && (event.target === "text" || event.target === "label") && event.value_redacted !== true) {
        violations.push(`${event.action}:text_value_redacted_required`);
    }
    for (const [field, value] of Object.entries({ target: event.target, detail: event.detail })) {
        if (!value) {
            continue;
        }
        if (/\d{17,20}/.test(value)) {
            violations.push(`${field}:raw_snowflake`);
        }
        if (/(^|[\s"'=])(?:\/Users\/|\/private\/|\/tmp\/|[A-Za-z]:\\)/.test(value)) {
            violations.push(`${field}:local_path`);
        }
    }

    return violations;
}
