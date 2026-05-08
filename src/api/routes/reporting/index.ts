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

import fs from "node:fs";
import path from "node:path";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { route } from "@spacebar/api";
import { ReportMenuType, ReportMenuTypeNames, CreateReportSchema, CreateReportRequiredFields, ReportingMenuResponse } from "@spacebar/schemas";
import { FieldErrors } from "@spacebar/util";

const router = Router({ mergeParams: true });
if (process.env.LOG_ROUTES !== "false") console.log("[Server] Registering reporting menu routes...");

const reportMenuDirectory = path.join(__dirname, "..", "..", "..", "..", "assets", "temp_report_menu_responses");

function getReportMenuType(type: string): ReportMenuType {
    const reportType = Number(Object.entries(ReportMenuTypeNames).find((x) => x[1] === type)?.[0]) as ReportMenuType;
    if (!(reportType in CreateReportRequiredFields)) throw new HTTPError("Unknown report menu type", 400);
    return reportType;
}

function loadReportMenu(type: string): ReportingMenuResponse {
    const menuPath = path.join(reportMenuDirectory, `${type}.json`);
    return JSON.parse(fs.readFileSync(menuPath, "utf-8")) as ReportingMenuResponse;
}

function assertRequiredFields(obj: CreateReportSchema, fields: (keyof CreateReportSchema)[]) {
    const missingFields = fields.filter((field) => !(field in obj));

    if (missingFields.length > 0)
        throw FieldErrors(
            Object.fromEntries(
                missingFields.map((field) => [
                    field,
                    {
                        message: `Missing required field ${field}.`,
                        code: "MISSING_FIELD",
                    },
                ]),
            ),
        );
}

function validateBreadcrumbs(menuData: ReportingMenuResponse, breadcrumbs: number[]): boolean {
    let node = menuData.nodes[menuData.root_node_id];
    if (!node || breadcrumbs[0] !== menuData.root_node_id) return false;

    for (let i = 1; i < breadcrumbs.length; i++) {
        const crumb = breadcrumbs[i];
        const nextNode = node.children.find((child) => child[1] === crumb);
        if (!nextNode) return false;

        const nextNodeData = menuData.nodes[crumb];
        if (!nextNodeData) return false;
        node = nextNodeData;
    }

    return true;
}

export function validateCreateReport(type: string, body: CreateReportSchema) {
    const menuData = loadReportMenu(type);
    if (body.name !== type)
        throw FieldErrors({
            name: {
                message: `Expected report type ${type} but got ${body.name}`,
                code: "INVALID_REPORT_TYPE",
            },
        });

    if (body.version !== menuData.version) {
        throw FieldErrors({
            version: {
                message: `Expected report menu version ${menuData.version} but got ${body.version}`,
                code: "INVALID_REPORT_MENU_VERSION",
            },
        });
    }

    if (body.variant !== menuData.variant) {
        throw FieldErrors({
            variant: {
                message: `Expected report menu variant ${menuData.variant} but got ${body.variant}`,
                code: "INVALID_REPORT_MENU_VARIANT",
            },
        });
    }

    if (body.breadcrumbs.find((breadcrumb) => !(breadcrumb in menuData.nodes))) {
        throw FieldErrors({
            breadcrumbs: {
                message: `Invalid report menu breadcrumbs.`,
                code: "INVALID_REPORT_MENU_BREADCRUMBS",
            },
        });
    }

    if (!validateBreadcrumbs(menuData, body.breadcrumbs))
        throw FieldErrors({
            breadcrumbs: {
                message: `Invalid report menu breadcrumbs path.`,
                code: "INVALID_REPORT_MENU_BREADCRUMBS_PATH",
            },
        });

    assertRequiredFields(body, CreateReportRequiredFields[getReportMenuType(type)]);
}

router.get(
    "/",
    route({
        description: "[EXT] Get available reporting menu types.",
        responses: {
            200: {
                body: "ReportingMenuTypesResponse",
            },
        },
    }),
    (req: Request, res: Response) => {
        res.json(Object.values(ReportMenuTypeNames));
    },
);

for (const type of Object.values(ReportMenuTypeNames)) {
    router.get(
        `/menu/${type}`,
        route({
            description: `Get reporting menu options for ${type} reports.`,
            query: {
                variant: { type: "string", required: false, description: "Version variant of the menu to retrieve (max 256 characters, default active)" },
            },
            responses: {
                200: {
                    body: "ReportingMenuResponse",
                },
                204: {},
            },
            spacebarOnly: false, // Maps to /reporting/menu/:id
        }),
        (req: Request, res: Response) => {
            // TODO: implement
            // res.send([] as ReportingMenuResponseSchema);
            res.sendFile(path.join(reportMenuDirectory, `${type}.json`));
        },
    );
    if (process.env.LOG_ROUTES !== "false") console.log(`[Server] Route /reporting/menu/${type} registered (reports).`);
    router.post(
        `/${type}`,
        route({
            description: `Get reporting menu options for ${type} reports.`,
            requestBody: "CreateReportSchema",
            responses: {
                200: {
                    body: "ReportingMenuResponse",
                },
                204: {},
            },
            spacebarOnly: false, // Maps to /reporting/:id
        }),
        (req: Request, res: Response) => {
            validateCreateReport(type, req.body as CreateReportSchema);
            res.status(204).send();
        },
    );
    if (process.env.LOG_ROUTES !== "false") console.log(`[Server] Route /reporting/${type} registered (reports).`);
}
export default router;
