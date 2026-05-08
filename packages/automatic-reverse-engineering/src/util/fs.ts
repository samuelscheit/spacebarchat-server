import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { sortForStableJson } from "./json.js";

export async function ensureDir(directory: string): Promise<void> {
    await mkdir(directory, { recursive: true });
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
    await ensureDir(path.dirname(filePath));
    await writeFile(filePath, `${JSON.stringify(sortForStableJson(value), null, "\t")}\n`, "utf8");
}

export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
}
