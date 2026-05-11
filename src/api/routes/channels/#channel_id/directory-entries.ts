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

import { route } from "@spacebar/api";
import { Channel, DiscordApiErrors } from "@spacebar/util";
import { ChannelType, type HubDirectoryEntriesResponse, type HubDirectoryEntryCountsResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
const router = Router({ mergeParams: true });

export function getEmptyDirectoryEntryCounts(): HubDirectoryEntryCountsResponse {
    return {};
}

async function requireDirectoryChannel(channel_id: string): Promise<void> {
    const channel = await Channel.findOneOrFail({
        where: { id: channel_id },
        select: {
            id: true,
            guild_id: true,
            type: true,
        },
    });

    if (channel.type !== ChannelType.GUILD_DIRECTORY) throw DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE;
}

router.get(
    "/counts",
    route({
        permission: "VIEW_CHANNEL",
        summary: "Get Directory Counts",
        responses: {
            200: {
                body: "HubDirectoryEntryCountsResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { channel_id } = req.params as { [key: string]: string };
        await requireDirectoryChannel(channel_id);

        return res.json(getEmptyDirectoryEntryCounts());
    },
);

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "HubDirectoryEntriesResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => {
        res.json([] as HubDirectoryEntriesResponse);
    },
);

export default router;
