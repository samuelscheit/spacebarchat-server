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

import { route } from "@spacebar/api";
import { DiscordApiErrors, GiftCode, GiftCodeBatch } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { requireApplicationGiftCodeBatchAccess, type ApplicationCommandAuthorizationRepository } from "../../../../util/utility/ApplicationAuthorization";

export type GiftCodeBatchCsvRow = {
    code: string;
};

export type GiftCodeBatchCsvBatch = {
    id: string;
};

export type GiftCodeBatchCsvRepositories = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    batchRepository?: {
        findOne(options: unknown): Promise<GiftCodeBatchCsvBatch | null>;
    };
    codeRepository?: {
        find(options: unknown): Promise<GiftCodeBatchCsvRow[]>;
    };
};

function escapeCsvCell(value: string) {
    if (!/[",\r\n]/.test(value)) return value;
    return `"${value.replace(/"/g, '""')}"`;
}

export function serializeGiftCodeBatchCsv(codes: GiftCodeBatchCsvRow[]) {
    return ["code", ...codes.map((giftCode) => escapeCsvCell(giftCode.code))].join("\r\n") + "\r\n";
}

function giftCodeBatchFilename(batchId: string) {
    return `gift-code-batch-${batchId.replace(/[^A-Za-z0-9_-]/g, "_")}.csv`;
}

export async function getApplicationGiftCodeBatchCsv(applicationId: string, giftCodeBatchId: string, userId: string, repositories: GiftCodeBatchCsvRepositories = {}) {
    await requireApplicationGiftCodeBatchAccess(applicationId, userId, repositories.applicationRepository);

    const batchRepository = repositories.batchRepository ?? {
        findOne: (options: unknown) => GiftCodeBatch.findOne(options as Parameters<typeof GiftCodeBatch.findOne>[0]) as Promise<GiftCodeBatchCsvBatch | null>,
    };
    const codeRepository = repositories.codeRepository ?? {
        find: (options: unknown) => GiftCode.find(options as Parameters<typeof GiftCode.find>[0]) as unknown as Promise<GiftCodeBatchCsvRow[]>,
    };
    const batch = await batchRepository.findOne({
        where: {
            id: giftCodeBatchId,
            application_id: applicationId,
        },
        select: {
            id: true,
        },
    });

    if (!batch) throw DiscordApiErrors.UNKNOWN_GIFT_CODE;

    const giftCodes = await codeRepository.find({
        where: {
            application_id: applicationId,
            batch_id: giftCodeBatchId,
        },
        select: {
            code: true,
        },
        order: {
            code: "ASC",
        },
    });

    return serializeGiftCodeBatchCsv(giftCodes);
}

export function createApplicationGiftCodeBatchRouter(repositories: GiftCodeBatchCsvRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            responses: {
                200: {},
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const applicationId = req.params.application_id as string;
            const giftCodeBatchId = req.params.gift_code_batch_id as string;
            const csv = await getApplicationGiftCodeBatchCsv(applicationId, giftCodeBatchId, req.user_id, repositories);

            res.set("Content-Type", "text/csv; charset=utf-8");
            res.set("Content-Disposition", `attachment; filename="${giftCodeBatchFilename(giftCodeBatchId)}"`);
            return res.status(200).send(csv);
        },
    );

    return router;
}

export default createApplicationGiftCodeBatchRouter();
