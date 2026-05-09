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

import { Config, FieldErrors } from "@spacebar/util";
import type { Embed } from "@spacebar/schemas";
import type { NextFunction, Request, Response } from "express";

export type MessagePayloadLimitInput = {
    content?: string | null;
    embeds?: readonly Embed[] | null;
    tts?: boolean | null;
};

type MessagePayloadLimitConfig = {
    maxCharacters: number;
    maxTTSCharacters: number;
    maxEmbeds: number;
    maxEmbedTitle?: number;
    maxEmbedDescription?: number;
    maxEmbedFields?: number;
    maxEmbedFieldName?: number;
    maxEmbedFieldValue?: number;
    maxEmbedFooterText?: number;
    maxEmbedAuthorName?: number;
    maxEmbedCharacters?: number;
};

const defaultEmbedLimits: Required<
    Pick<
        MessagePayloadLimitConfig,
        "maxEmbedTitle" | "maxEmbedDescription" | "maxEmbedFields" | "maxEmbedFieldName" | "maxEmbedFieldValue" | "maxEmbedFooterText" | "maxEmbedAuthorName" | "maxEmbedCharacters"
    >
> = {
    maxEmbedTitle: 256,
    maxEmbedDescription: 4096,
    maxEmbedFields: 25,
    maxEmbedFieldName: 256,
    maxEmbedFieldValue: 1024,
    maxEmbedFooterText: 2048,
    maxEmbedAuthorName: 256,
    maxEmbedCharacters: 6000,
};

function getConfiguredLimit<K extends keyof typeof defaultEmbedLimits>(limits: MessagePayloadLimitConfig, key: K): number {
    const configured = limits[key];
    return typeof configured === "number" && Number.isFinite(configured) ? configured : defaultEmbedLimits[key];
}

function addLengthError(errors: Record<string, { code: string; message: string }>, path: string, maxLength: number) {
    errors[path] = {
        code: "BASE_TYPE_MAX_LENGTH",
        message: `Must be ${maxLength} or fewer in length.`,
    };
}

function countEmbedCharacters(value: unknown): number {
    return typeof value === "string" ? value.length : 0;
}

function assertMessageEmbedLimits(embeds: readonly Embed[] | null | undefined, limits: MessagePayloadLimitConfig, errors: Record<string, { code: string; message: string }>) {
    if (!Array.isArray(embeds)) return;

    const maxEmbedTitle = getConfiguredLimit(limits, "maxEmbedTitle");
    const maxEmbedDescription = getConfiguredLimit(limits, "maxEmbedDescription");
    const maxEmbedFields = getConfiguredLimit(limits, "maxEmbedFields");
    const maxEmbedFieldName = getConfiguredLimit(limits, "maxEmbedFieldName");
    const maxEmbedFieldValue = getConfiguredLimit(limits, "maxEmbedFieldValue");
    const maxEmbedFooterText = getConfiguredLimit(limits, "maxEmbedFooterText");
    const maxEmbedAuthorName = getConfiguredLimit(limits, "maxEmbedAuthorName");
    const maxEmbedCharacters = getConfiguredLimit(limits, "maxEmbedCharacters");
    let totalEmbedCharacters = 0;

    for (const [embedIndex, embed] of embeds.entries()) {
        totalEmbedCharacters += countEmbedCharacters(embed.title);
        if (typeof embed.title === "string" && embed.title.length > maxEmbedTitle) {
            addLengthError(errors, `embeds[${embedIndex}].title`, maxEmbedTitle);
        }

        totalEmbedCharacters += countEmbedCharacters(embed.description);
        if (typeof embed.description === "string" && embed.description.length > maxEmbedDescription) {
            addLengthError(errors, `embeds[${embedIndex}].description`, maxEmbedDescription);
        }

        totalEmbedCharacters += countEmbedCharacters(embed.footer?.text);
        if (typeof embed.footer?.text === "string" && embed.footer.text.length > maxEmbedFooterText) {
            addLengthError(errors, `embeds[${embedIndex}].footer.text`, maxEmbedFooterText);
        }

        totalEmbedCharacters += countEmbedCharacters(embed.author?.name);
        if (typeof embed.author?.name === "string" && embed.author.name.length > maxEmbedAuthorName) {
            addLengthError(errors, `embeds[${embedIndex}].author.name`, maxEmbedAuthorName);
        }

        if (Array.isArray(embed.fields)) {
            if (embed.fields.length > maxEmbedFields) {
                errors[`embeds[${embedIndex}].fields`] = {
                    code: "BASE_TYPE_MAX_ITEMS",
                    message: `Must contain ${maxEmbedFields} or fewer items.`,
                };
            }

            for (const [fieldIndex, field] of embed.fields.entries()) {
                totalEmbedCharacters += countEmbedCharacters(field.name) + countEmbedCharacters(field.value);
                if (typeof field.name === "string" && field.name.length > maxEmbedFieldName) {
                    addLengthError(errors, `embeds[${embedIndex}].fields[${fieldIndex}].name`, maxEmbedFieldName);
                }
                if (typeof field.value === "string" && field.value.length > maxEmbedFieldValue) {
                    addLengthError(errors, `embeds[${embedIndex}].fields[${fieldIndex}].value`, maxEmbedFieldValue);
                }
            }
        }
    }

    if (totalEmbedCharacters > maxEmbedCharacters) {
        errors.embeds ??= {
            code: "BASE_TYPE_MAX_LENGTH",
            message: `Must contain ${maxEmbedCharacters} or fewer total characters across all embeds.`,
        };
    }
}

export function assertMessagePayloadLimits(body: MessagePayloadLimitInput | null | undefined) {
    if (!body) return;

    const limits = Config.get().limits.message as MessagePayloadLimitConfig;
    const { maxCharacters, maxTTSCharacters, maxEmbeds } = limits;
    const errors: Record<string, { code: string; message: string }> = {};
    const content = body.content;
    const embeds = body.embeds;

    if (typeof content === "string" && content.length > maxCharacters) {
        errors.content = {
            code: "BASE_TYPE_MAX_LENGTH",
            message: `Must be ${maxCharacters} or fewer in length.`,
        };
    }

    if (body.tts && typeof content === "string" && content.length > maxTTSCharacters) {
        errors.content = {
            code: "BASE_TYPE_MAX_LENGTH",
            message: `TTS messages must be ${maxTTSCharacters} or fewer in length.`,
        };
    }

    if (Array.isArray(embeds) && embeds.length > maxEmbeds) {
        errors.embeds = {
            code: "BASE_TYPE_MAX_ITEMS",
            message: `Must contain ${maxEmbeds} or fewer items.`,
        };
    }
    assertMessageEmbedLimits(embeds, limits, errors);

    if (Object.keys(errors).length) throw FieldErrors(errors);
}

export function validateMessagePayloadLimits(req: Request, _res: Response, next: NextFunction) {
    assertMessagePayloadLimits(req.body as MessagePayloadLimitInput);
    next();
}
