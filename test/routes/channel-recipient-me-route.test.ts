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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const SOURCE_CATALOG_PATH = join(process.cwd(), "packages/automatic-reverse-engineering/data/catalogs/routes.source.catalog.json");
const CONTRACTS_PATH = join(process.cwd(), "test/generated/http-contracts.json");
const ASSIGNED_SOURCE_ROUTE = "/channels/{channel_id}/recipients/@me";
const ASSIGNED_MANIFEST_ROUTE = "/channels/:channel_id/recipients/@me";
const ASSIGNED_METHODS = ["DELETE", "PATCH", "PUT"];

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("generated artifacts for /channels/{channel_id}/recipients/@me", () => {
    test("source route catalog contains the assigned DELETE, PATCH, and PUT methods", () => {
        const catalog = readJson<
            Array<{
                method: string;
                response_schema_refs?: string[];
                route: string;
                source: string;
            }>
        >(SOURCE_CATALOG_PATH);

        for (const method of ASSIGNED_METHODS) {
            const entry = catalog.find((candidate) => candidate.method === method && candidate.route === ASSIGNED_SOURCE_ROUTE);
            assert.ok(entry, `${method} ${ASSIGNED_SOURCE_ROUTE} is missing from the source catalog`);
            assert.equal(entry.source, "src/api/routes/channels/#channel_id/recipients.ts");
            assert.ok(entry.response_schema_refs?.includes("APIErrorResponse"), `${method} is missing APIErrorResponse metadata`);
            assert.ok(entry.response_schema_refs?.includes("DmChannelDTO"), `${method} is missing DmChannelDTO metadata`);
        }
    });

    test("generated HTTP contracts contain the assigned authenticated route methods", () => {
        const matrix = readJson<{
            contracts: Array<{
                authMode: string;
                method: string;
                path: string;
                routeMetadata: {
                    requestBody?: string;
                    responseStatuses: number[];
                    responses: string[];
                };
                sourceFile: string;
            }>;
        }>(CONTRACTS_PATH);

        for (const method of ASSIGNED_METHODS) {
            const contract = matrix.contracts.find((candidate) => candidate.method === method && candidate.path === ASSIGNED_MANIFEST_ROUTE);
            assert.ok(contract, `${method} ${ASSIGNED_MANIFEST_ROUTE} is missing from generated HTTP contracts`);
            assert.equal(contract.authMode, "bearer");
            assert.equal(contract.sourceFile, "src/api/routes/channels/#channel_id/recipients.ts");
            assert.ok(contract.routeMetadata.responseStatuses.includes(401), `${method} is missing authenticated 401 metadata`);
            assert.ok(contract.routeMetadata.responses.includes("APIErrorResponse"), `${method} is missing APIErrorResponse contract metadata`);
            assert.ok(contract.routeMetadata.responses.includes("DmChannelDTO"), `${method} is missing DmChannelDTO contract metadata`);
            if (method !== "DELETE") assert.equal(contract.routeMetadata.requestBody, "ChannelRecipientMeUpdateSchema");
        }
    });
});
