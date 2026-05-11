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
import type { ReportReasonsResponse } from "@spacebar/schemas";
import { FieldErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

const snowflakePattern = /^[1-9]\d{16,19}$/;
const reportReasons: ReportReasonsResponse = [];

type FieldErrorInput = Record<string, { code: string; message: string }>;

export type ReportReasonsTarget =
    | {
          type: "message";
          channel_id: string;
          message_id: string;
      }
    | {
          type: "user";
          user_id: string;
      };

function hasQueryParam(query: Request["query"], key: string): boolean {
    return Object.prototype.hasOwnProperty.call(query, key);
}

function stringQueryParam(query: Request["query"], key: string, errors: FieldErrorInput): string | undefined {
    const value = query[key];
    if (value === undefined) return undefined;

    if (typeof value === "string") return value;

    errors[key] = {
        code: "BASE_TYPE_REQUIRED",
        message: `Query parameter ${key} must be a string snowflake.`,
    };
    return undefined;
}

function validateSnowflakeField(key: string, value: string | undefined, errors: FieldErrorInput) {
    if (value === undefined) return;
    if (snowflakePattern.test(value)) return;

    errors[key] = {
        code: "BASE_TYPE_BAD_LENGTH",
        message: `Query parameter ${key} must be a valid snowflake.`,
    };
}

export function parseReportReasonsQuery(query: Request["query"]): ReportReasonsTarget {
    const errors: FieldErrorInput = {};
    const hasChannelId = hasQueryParam(query, "channel_id");
    const hasMessageId = hasQueryParam(query, "message_id");
    const hasUserId = hasQueryParam(query, "user_id");
    const hasMessageTarget = hasChannelId || hasMessageId;

    const channelId = stringQueryParam(query, "channel_id", errors);
    const messageId = stringQueryParam(query, "message_id", errors);
    const userId = stringQueryParam(query, "user_id", errors);

    if (hasMessageTarget && hasUserId) {
        errors.target = {
            code: "REPORT_TARGET_CONFLICT",
            message: "Either channel_id and message_id, or user_id must be provided, not both.",
        };
    } else if (!hasMessageTarget && !hasUserId) {
        errors.target = {
            code: "REPORT_TARGET_REQUIRED",
            message: "Either channel_id and message_id, or user_id must be provided.",
        };
    }

    if (hasMessageTarget) {
        if (!hasChannelId) {
            errors.channel_id = {
                code: "MISSING_FIELD",
                message: "Query parameter channel_id is required when message_id is provided.",
            };
        }

        if (!hasMessageId) {
            errors.message_id = {
                code: "MISSING_FIELD",
                message: "Query parameter message_id is required when channel_id is provided.",
            };
        }
    }

    validateSnowflakeField("channel_id", channelId, errors);
    validateSnowflakeField("message_id", messageId, errors);
    validateSnowflakeField("user_id", userId, errors);

    if (Object.keys(errors).length > 0) throw FieldErrors(errors);

    if (hasUserId) {
        return {
            type: "user",
            user_id: userId!,
        };
    }

    return {
        type: "message",
        channel_id: channelId!,
        message_id: messageId!,
    };
}

export function listReportReasons(_target: ReportReasonsTarget): ReportReasonsResponse {
    return [...reportReasons];
}

router.get(
    "/",
    route({
        summary: "Get Report Reasons",
        description: "Returns legacy report reason objects that can be used when creating a report for a message or user.",
        query: {
            channel_id: { type: "string", required: false, description: "The ID of the channel containing the message to report." },
            message_id: { type: "string", required: false, description: "The ID of the message to report." },
            user_id: { type: "string", required: false, description: "The ID of the user to report." },
        },
        responses: {
            200: {
                body: "ReportReasonsResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
        spacebarOnly: false,
    }),
    (req: Request, res: Response) => {
        res.status(200).json(listReportReasons(parseReportReasonsQuery(req.query)));
    },
);

export default router;
