/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2025 Spacebar and Spacebar Contributors
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Readable } from "node:stream";
import { Storage } from "./Storage";

interface S3Client {
    putObject(input: { Bucket: string; Key: string; Body: Buffer }): Promise<unknown>;
    copyObject(input: { Bucket: string; CopySource: string; Key: string }): Promise<unknown>;
    getObject(input: { Bucket: string; Key: string }): Promise<{ Body?: unknown }>;
    deleteObject(input: { Bucket: string; Key: string }): Promise<unknown>;
    headObject(input: { Bucket: string; Key: string }): Promise<unknown>;
}

const encodeS3CopySourcePath = (value: string) => value.split("/").map(encodeURIComponent).join("/");

export const getS3CopySource = (bucket: string, key: string) => `${encodeURIComponent(bucket)}/${encodeS3CopySourcePath(key)}`;

const readableToBuffer = (readable: Readable): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        readable.on("data", (chunk) => chunks.push(chunk));
        readable.on("error", reject);
        readable.on("end", () => resolve(Buffer.concat(chunks)));
    });

export class S3Storage implements Storage {
    private client: S3Client;
    public constructor(
        private region: string,
        private bucket: string,
        private endpoint: string,
        private forcePathStyle: boolean,
        private basePath?: string,
        client?: S3Client,
    ) {
        if (client) {
            this.client = client;
            return;
        }

        const { S3 } = require("@aws-sdk/client-s3");
        this.client = new S3({ region: region, endpoint: endpoint, forcePathStyle: forcePathStyle });
    }
    isFile(path: string): Promise<boolean> {
        return this.exists(path);
    }

    /**
     * Always return a string, to ensure consistency.
     */
    get bucketBasePath() {
        return this.basePath ?? "";
    }

    private getKey(path: string) {
        return `${this.bucketBasePath}${path}`;
    }

    async set(path: string, data: Buffer): Promise<void> {
        await this.client.putObject({
            Bucket: this.bucket,
            Key: this.getKey(path),
            Body: data,
        });
    }

    async clone(path: string, newPath: string): Promise<void> {
        await this.client.copyObject({
            Bucket: this.bucket,
            CopySource: getS3CopySource(this.bucket, this.getKey(path)),
            Key: this.getKey(newPath),
        });
    }

    async get(path: string): Promise<Buffer | null> {
        try {
            const s3Object = await this.client.getObject({
                Bucket: this.bucket,
                Key: this.getKey(path),
            });

            if (!s3Object.Body) return null;

            const body = s3Object.Body;

            return await readableToBuffer(<Readable>body);
        } catch (err) {
            console.error(`[CDN] Unable to get S3 object at path ${path}.`);
            console.error(err);
            return null;
        }
    }

    async delete(path: string): Promise<void> {
        await this.client.deleteObject({
            Bucket: this.bucket,
            Key: this.getKey(path),
        });
    }

    async exists(path: string): Promise<boolean> {
        try {
            await this.client.headObject({
                Bucket: this.bucket,
                Key: this.getKey(path),
            });
            return true;
        } catch (err) {
            if (err && typeof err === "object" && "name" in err && (err as { [key: string]: string }).name === "NotFound") {
                return false;
            }
            console.error(`[CDN] Unable to check existence of S3 object at path ${path}.`);
            console.error(err);
            return false;
        }
    }

    async move(path: string, newPath: string): Promise<void> {
        await this.clone(path, newPath);
        await this.delete(path);
    }
}
