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
import type { CompanyResponse, CompanySearchResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { Like } from "typeorm";

export type CompanySearchRecord = CompanyResponse;

export type CompanySearchRepository = {
    find(options: unknown): Promise<CompanySearchRecord[]>;
};

export type CompanySearchRepositories = {
    companyRepository?: CompanySearchRepository;
};

export type CompanySearchQuery = {
    name?: string;
};

const DEFAULT_COMPANY_SEARCH_LIMIT = 25;

function firstQueryValue(value: unknown): string | undefined {
    if (Array.isArray(value)) return firstQueryValue(value[0]);
    if (typeof value === "string") return value;

    return undefined;
}

function getCompanyRepository(repository?: CompanySearchRepository): CompanySearchRepository {
    return (
        repository ?? {
            find: async () => [],
        }
    );
}

export function parseCompanySearchQuery(query: Record<string, unknown>): CompanySearchQuery {
    const name = firstQueryValue(query.name)?.trim();

    return name ? { name } : {};
}

export function serializeCompanySearchResponse(companies: CompanySearchRecord[]): CompanySearchResponse {
    return companies.map((company) => ({
        id: company.id,
        name: company.name,
    }));
}

export async function searchCompanies(name: string, repositories: CompanySearchRepositories = {}): Promise<CompanySearchResponse> {
    const companyRepository = getCompanyRepository(repositories.companyRepository);
    const companies = await companyRepository.find({
        where: { name: Like(`%${name}%`) },
        select: { id: true, name: true },
        order: { name: "ASC" },
        take: DEFAULT_COMPANY_SEARCH_LIMIT,
    });

    return serializeCompanySearchResponse(companies);
}

export function createCompaniesRouter(repositories: CompanySearchRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Search Companies",
            query: {
                name: {
                    type: "string",
                    description: "Query to match company names against.",
                },
            },
            responses: {
                200: {
                    body: "CompanySearchResponse",
                },
                204: {},
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const query = parseCompanySearchQuery(req.query as Record<string, unknown>);

            if (!query.name) return res.status(204).send();

            const companies = await searchCompanies(query.name, repositories);
            return res.status(200).json(companies);
        },
    );

    return router;
}

export default createCompaniesRouter();
