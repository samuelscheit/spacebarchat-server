import { readFile } from "node:fs/promises";

import { CaptureEvent } from "../types.js";

export async function readNdjsonEvents(filePath: string): Promise<CaptureEvent[]> {
    const raw = await readFile(filePath, "utf8");
    return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as CaptureEvent);
}
