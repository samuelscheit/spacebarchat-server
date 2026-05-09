/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
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

import { Router, Response, Request } from "express";
import { route } from "@spacebar/api";

const router = Router({ mergeParams: true });

export interface EmailSettingsResponse {
    categories: {
        social: boolean;
        communication: boolean;
        tips: boolean;
        updates_and_announcements: boolean;
        recommendations_and_events: boolean;
    };
    initialized: boolean;
}

export const DefaultEmailSettingsResponse: EmailSettingsResponse = Object.freeze({
    categories: Object.freeze({
        social: true,
        communication: true,
        tips: false,
        updates_and_announcements: false,
        recommendations_and_events: false,
    }),
    initialized: false,
});

router.get(
    "/",
    route({
        responses: {
            200: {},
            401: {
                body: "APIErrorResponse",
            },
        },
        summary: "Get Email Settings",
        description: "Returns the server's default email notification preferences for Discord client compatibility.",
    }),
    (req: Request, res: Response) => {
        res.status(200).json(DefaultEmailSettingsResponse);
    },
);

export default router;
