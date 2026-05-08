import fs from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { FileStorage } from "@spacebar/cdn";

export interface FileStorageFixture {
    root: string;
    storage: FileStorage;
}

export interface UploadFixture {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}

export async function withFileStorage<T>(fn: (fixture: FileStorageFixture) => T | Promise<T>): Promise<T> {
    const previousLocation = process.env.STORAGE_LOCATION;
    const root = await fs.mkdtemp(join(tmpdir(), "spacebar-cdn-"));
    process.env.STORAGE_LOCATION = root;

    try {
        return await fn({ root, storage: new FileStorage() });
    } finally {
        if (previousLocation === undefined) delete process.env.STORAGE_LOCATION;
        else process.env.STORAGE_LOCATION = previousLocation;

        await fs.rm(root, { force: true, recursive: true });
    }
}

export async function createCdnObject(storage: FileStorage, path: string, data: Buffer = Buffer.from("spacebar-test-file")) {
    const fsPath = storage.getFsPath(path);
    await fs.mkdir(dirname(fsPath), { recursive: true });
    await fs.writeFile(fsPath, data);
    return { path, fsPath, data };
}

export function createUploadFile(originalname = "fixture.txt", mimetype = "text/plain", data: Buffer = Buffer.from("spacebar-upload")): UploadFixture {
    return {
        buffer: data,
        originalname,
        mimetype,
        size: data.length,
    };
}
