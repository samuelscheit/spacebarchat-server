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

import { createApexExperimentsMetadataResponse, createApexExperimentsResponse, route } from "@spacebar/api";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

router.get(
    "/metadata",
    route({
        summary: "Get Metadata for Apex Experiments",
        description:
            "Returns Apex experiment metadata for instance operators. Spacebar does not persist Discord's employee-only Apex rollout metadata yet, so this returns an empty metadata list instead of fabricating upstream experiments.",
        right: "OPERATOR",
        query: {
            surface: {
                type: "integer",
                required: true,
                description: "The surface to return Apex experiment metadata for.",
            },
        },
        responses: {
            200: {
                body: "ApexExperimentsMetadataResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => {
        res.json(createApexExperimentsMetadataResponse());
    },
);

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "ApexExperimentsResponse",
            },
        },
    }),
    (req: Request, res: Response) => {
        res.send(createApexExperimentsResponse(req.header("X-Installation-ID")));
    },
);

export default router;
