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
import { Channel, DiscordApiErrors, FieldErrors } from "@spacebar/util";
import { ChannelType, type HubDirectoryEntriesResponse, type HubDirectoryEntryCountsResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
const router = Router({ mergeParams: true });

export const DIRECTORY_ENTRY_SEARCH_QUERY_MIN_LENGTH = 1;
export const DIRECTORY_ENTRY_SEARCH_QUERY_MAX_LENGTH = 100;
export const DIRECTORY_ENTRY_TYPE_QUERY_VALUES = ["0", "1"] as const;
export const DIRECTORY_ENTRY_CATEGORY_QUERY_VALUES = ["0", "1", "2", "3", "5"] as const;

export interface DirectoryEntrySearchQueryOptions {
    query: string;
    type?: number;
    category_id?: number;
}

export function getEmptyDirectoryEntryCounts(): HubDirectoryEntryCountsResponse {
    return {};
}

export function getDirectoryEntrySearchResults(_options: DirectoryEntrySearchQueryOptions): HubDirectoryEntriesResponse {
    return [];
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

function directoryEntrySearchQueryError(field: string, code: string, message: string): never {
    throw FieldErrors({
        [field]: {
            code,
            message,
        },
    });
}

function parseDirectoryEntrySearchString(value: unknown): string {
    if (value === undefined) {
        directoryEntrySearchQueryError("query", "BASE_TYPE_REQUIRED", "This field is required");
    }

    if (typeof value !== "string") {
        directoryEntrySearchQueryError("query", "BASE_TYPE_STRING", "This field must be a string");
    }

    if (value.length < DIRECTORY_ENTRY_SEARCH_QUERY_MIN_LENGTH || value.length > DIRECTORY_ENTRY_SEARCH_QUERY_MAX_LENGTH) {
        directoryEntrySearchQueryError(
            "query",
            "BASE_TYPE_BAD_LENGTH",
            `Must be between ${DIRECTORY_ENTRY_SEARCH_QUERY_MIN_LENGTH} and ${DIRECTORY_ENTRY_SEARCH_QUERY_MAX_LENGTH} in length.`,
        );
    }

    return value;
}

function parseOptionalDirectoryEntryIntegerFilter(field: "type" | "category_id", value: unknown, allowedValues: readonly string[]): number | undefined {
    if (value === undefined) return undefined;

    if (typeof value !== "string" || !allowedValues.includes(value)) {
        directoryEntrySearchQueryError(field, "BASE_TYPE_CHOICES", `This field must be one of (${allowedValues.join(", ")})`);
    }

    return Number(value);
}

export function parseDirectoryEntrySearchQuery(query: Request["query"]): DirectoryEntrySearchQueryOptions {
    const options: DirectoryEntrySearchQueryOptions = {
        query: parseDirectoryEntrySearchString(query.query),
    };
    const type = parseOptionalDirectoryEntryIntegerFilter("type", query.type, DIRECTORY_ENTRY_TYPE_QUERY_VALUES);
    const category_id = parseOptionalDirectoryEntryIntegerFilter("category_id", query.category_id, DIRECTORY_ENTRY_CATEGORY_QUERY_VALUES);

    if (type !== undefined) options.type = type;
    if (category_id !== undefined) options.category_id = category_id;

    return options;
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
    "/search",
    route({
        permission: "VIEW_CHANNEL",
        summary: "Search Directory Entries",
        query: {
            query: {
                type: "string",
                required: true,
                description: "Directory entry search text to match. Discord documents 1 to 100 characters.",
            },
            type: {
                type: "integer",
                description: "Directory entry type to filter by.",
                values: [...DIRECTORY_ENTRY_TYPE_QUERY_VALUES],
            },
            category_id: {
                type: "integer",
                description: "Directory entry primary category to filter by.",
                values: [...DIRECTORY_ENTRY_CATEGORY_QUERY_VALUES],
            },
        },
        responses: {
            200: {
                body: "HubDirectoryEntriesResponse",
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
        const searchQuery = parseDirectoryEntrySearchQuery(req.query);
        await requireDirectoryChannel(channel_id);

        return res.json(getDirectoryEntrySearchResults(searchQuery));
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
