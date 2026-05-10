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
import type { CompanyResponse } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type CompanyRecord = CompanyResponse;

export type CompanyRepository = {
    findOne(options: unknown): Promise<CompanyRecord | null>;
};

export type CompanyRepositories = {
    companyRepository?: CompanyRepository;
};

export const UNKNOWN_COMPANY_ERROR = new ApiError("Unknown Company", 404, 404);

function getCompanyRepository(repository?: CompanyRepository): CompanyRepository {
    return (
        repository ?? {
            findOne: async () => null,
        }
    );
}

export function serializeCompanyResponse(company: CompanyRecord): CompanyResponse {
    return {
        id: company.id,
        name: company.name,
    };
}

export async function getCompany(companyId: string, repositories: CompanyRepositories = {}): Promise<CompanyResponse> {
    const companyRepository = getCompanyRepository(repositories.companyRepository);
    const company = await companyRepository.findOne({
        where: { id: companyId },
        select: { id: true, name: true },
    });

    if (!company) throw UNKNOWN_COMPANY_ERROR;
    return serializeCompanyResponse(company);
}

export function createCompanyRouter(repositories: CompanyRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Company",
            responses: {
                200: {
                    body: "CompanyResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const company = await getCompany(req.params.company_id as string, repositories);

            return res.status(200).json(company);
        },
    );

    return router;
}

export default createCompanyRouter();
