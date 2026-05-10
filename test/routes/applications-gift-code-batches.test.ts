/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

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

import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import express from "express";
import { DiscordApiErrors } from "@spacebar/util";
import {
    createApplicationGiftCodeBatchRouter,
    getApplicationGiftCodeBatchCsv,
    serializeGiftCodeBatchCsv,
    type GiftCodeBatchCsvRepositories,
} from "../../src/api/routes/applications/#application_id/gift-code-batches/#gift_code_batch_id";

const coveredManifestIds = ["api:http:GET:/applications/:application_id/gift-code-batches/:gift_code_batch_id/"];

function createApp(userId = "owner", repositories: GiftCodeBatchCsvRepositories = {}) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/applications/:application_id/gift-code-batches/:gift_code_batch_id", createApplicationGiftCodeBatchRouter(repositories));
    app.use((error: { code?: number; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 500).json({
            code: error.code,
            message: error.message,
        });
    });

    return app;
}

async function request(app: express.Express, path: string) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        return await fetch(`http://127.0.0.1:${port}${path}`);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /applications/:application_id/gift-code-batches/:gift_code_batch_id", () => {
    test("serializes gift code CSV with standard escaping", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/applications/:application_id/gift-code-batches/:gift_code_batch_id/"]);
        assert.equal(
            serializeGiftCodeBatchCsv([{ code: "plain" }, { code: 'quote"code' }, { code: "comma,code" }, { code: "line\ncode" }]),
            'code\r\nplain\r\n"quote""code"\r\n"comma,code"\r\n"line\ncode"\r\n',
        );
    });

    test("authorizes the caller, verifies the batch belongs to the application, and exports stored codes", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
            })),
        };
        const batchRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                id: "batch",
            })),
        };
        const codeRepository = {
            find: t.mock.fn(async (_options: unknown) => [{ code: "alpha" }, { code: "beta" }]),
        };

        const csv = await getApplicationGiftCodeBatchCsv("app", "batch", "owner", {
            applicationRepository,
            batchRepository,
            codeRepository,
        });

        assert.equal(csv, "code\r\nalpha\r\nbeta\r\n");
        assert.deepEqual(batchRepository.findOne.mock.calls[0].arguments[0], {
            where: {
                id: "batch",
                application_id: "app",
            },
            select: {
                id: true,
            },
        });
        assert.deepEqual(codeRepository.find.mock.calls[0].arguments[0], {
            where: {
                application_id: "app",
                batch_id: "batch",
            },
            select: {
                code: true,
            },
            order: {
                code: "ASC",
            },
        });
    });

    test("throws unknown gift code when the requested application batch does not exist", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
            })),
        };
        const batchRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        await assert.rejects(
            () =>
                getApplicationGiftCodeBatchCsv("app", "missing", "owner", {
                    applicationRepository,
                    batchRepository,
                    codeRepository: {
                        find: async () => {
                            throw new Error("gift code lookup should not run for missing batches");
                        },
                    },
                }),
            (error) => error === DiscordApiErrors.UNKNOWN_GIFT_CODE,
        );
    });

    test("returns a CSV download from the mounted route", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
            })),
        };
        const batchRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                id: "batch",
            })),
        };
        const codeRepository = {
            find: t.mock.fn(async (_options: unknown) => [{ code: "alpha" }, { code: "beta" }]),
        };

        const response = await request(createApp("owner", { applicationRepository, batchRepository, codeRepository }), "/applications/app/gift-code-batches/batch");

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
        assert.equal(response.headers.get("content-disposition"), 'attachment; filename="gift-code-batch-batch.csv"');
        assert.equal(await response.text(), "code\r\nalpha\r\nbeta\r\n");
    });

    test("returns the gift code error when the mounted route cannot find the batch", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
            })),
        };
        const batchRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };
        const codeRepository = {
            find: t.mock.fn(async (_options: unknown) => {
                throw new Error("gift code lookup should not run for missing batches");
            }),
        };

        const response = await request(createApp("owner", { applicationRepository, batchRepository, codeRepository }), "/applications/app/gift-code-batches/missing");
        const body = (await response.json()) as { code: number; message: string };

        assert.equal(response.status, 400);
        assert.equal(body.code, DiscordApiErrors.UNKNOWN_GIFT_CODE.code);
    });

    test("returns the application authorization error for non-owner non-team callers", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
            })),
        };
        const batchRepository = {
            findOne: t.mock.fn(async (_options: unknown) => {
                throw new Error("batch lookup should not run before authorization");
            }),
        };

        const response = await request(createApp("intruder", { applicationRepository, batchRepository }), "/applications/app/gift-code-batches/batch");
        const body = (await response.json()) as { code: number; message: string };

        assert.equal(response.status, 400);
        assert.equal(body.code, DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code);
    });
});
