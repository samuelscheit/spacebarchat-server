import assert from "node:assert/strict";
import { createServer, Server } from "node:http";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddressInfo } from "node:net";
import { once } from "node:events";
import crypto from "node:crypto";
import express, { NextFunction, Request, Response, Router } from "express";
import { after, before, describe, mock, test } from "node:test";
import { Config, ConfigValue } from "@spacebar/util";

const PNG_IMAGE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
const WEBP_IMAGE = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64");
const GIF_IMAGE = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

describe("role icon CDN route", () => {
    const requestSignature = "role-icon-test-signature";
    const previousStorageProvider = process.env.STORAGE_PROVIDER;
    const previousStorageLocation = process.env.STORAGE_LOCATION;
    let storageRoot = "";
    let server: Server;
    let baseUrl = "";

    before(async () => {
        storageRoot = await mkdtemp(join(tmpdir(), "spacebar-role-icons-"));
        process.env.STORAGE_PROVIDER = "file";
        process.env.STORAGE_LOCATION = storageRoot;

        mock.method(Config, "get", () => {
            const config = new ConfigValue();
            config.cdn.endpointPublic = "https://cdn.example.test";
            config.security.requestSignature = requestSignature;
            return config;
        });

        const moduleDefault = (await import("./role-icons.js")).default as unknown as Router & { default?: Router };
        const roleIcons = moduleDefault.default ?? moduleDefault;
        const app = express();
        app.use("/role-icons", roleIcons);
        app.use((error: Error & { code?: number }, _req: Request, res: Response, _next: NextFunction) => {
            res.status(error.code ?? 500).json({ message: error.message });
        });

        server = createServer(app);
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
        const address = server.address() as AddressInfo;
        baseUrl = `http://${address.address}:${address.port}`;
    });

    after(async () => {
        mock.restoreAll();
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
        await rm(storageRoot, { recursive: true, force: true });

        if (previousStorageProvider === undefined) delete process.env.STORAGE_PROVIDER;
        else process.env.STORAGE_PROVIDER = previousStorageProvider;
        if (previousStorageLocation === undefined) delete process.env.STORAGE_LOCATION;
        else process.env.STORAGE_LOCATION = previousStorageLocation;
    });

    test("stores uploaded WebP role icons at extensionless hash paths and serves extension aliases", async () => {
        const roleId = "webp-role";
        const response = await uploadRoleIcon(roleId, WEBP_IMAGE, "image/webp", "icon.webp");
        const body = (await response.json()) as { content_type: string; id: string; url: string };
        const expectedHash = crypto.createHash("md5").update(WEBP_IMAGE).digest("hex");

        assert.equal(response.status, 200);
        assert.equal(body.id, expectedHash);
        assert.equal(body.content_type, "image/webp");
        assert.equal(body.url, `https://cdn.example.test/role-icons/${roleId}/${expectedHash}`);
        await access(join(storageRoot, "role-icons", roleId, expectedHash));
        await assert.rejects(access(join(storageRoot, "role-icons", roleId, `${expectedHash}.png`)));

        for (const hashPath of [expectedHash, `${expectedHash}.webp`]) {
            const download = await fetch(`${baseUrl}/role-icons/${roleId}/${hashPath}`);
            assert.equal(download.status, 200);
            assert.equal(download.headers.get("content-type"), "image/webp");
            assert.ok((await download.arrayBuffer()).byteLength > 0);
        }
    });

    test("deletes legacy role icon keys after extensionless fallback misses", async () => {
        const roleId = "legacy-role";
        const hash = "legacyhash";
        const legacyDir = join(storageRoot, "role-icons", roleId);
        const legacyPath = join(legacyDir, `${hash}.png`);
        await mkdir(legacyDir, { recursive: true });
        await writeFile(legacyPath, PNG_IMAGE);

        const response = await fetch(`${baseUrl}/role-icons/${roleId}/${hash}`, {
            headers: { signature: requestSignature },
            method: "DELETE",
        });

        assert.equal(response.status, 200);
        await assert.rejects(access(legacyPath));
    });

    test("rejects animated GIF role icons", async () => {
        const response = await uploadRoleIcon("animated-role", GIF_IMAGE, "image/gif", "icon.gif");
        const body = (await response.json()) as { message: string };

        assert.equal(response.status, 400);
        assert.equal(body.message, "Invalid file type");
    });

    async function uploadRoleIcon(roleId: string, image: Buffer, contentType: string, filename: string) {
        const form = new FormData();
        form.append("file", new Blob([Uint8Array.from(image)], { type: contentType }), filename);

        return fetch(`${baseUrl}/role-icons/${roleId}`, {
            body: form,
            headers: { signature: requestSignature },
            method: "POST",
        });
    }
});
