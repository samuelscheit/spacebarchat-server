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
import type { MessageCreateSchema } from "@spacebar/schemas";

type MessagePayloadLimitInput = Pick<MessageCreateSchema, "content" | "embeds" | "tts">;

export function assertMessagePayloadLimits(body: MessagePayloadLimitInput) {
    const { maxCharacters, maxTTSCharacters, maxEmbeds } = Config.get().limits.message;
    const errors: Record<string, { code: string; message: string }> = {};

    if (body.content && body.content.length > maxCharacters) {
        errors.content = {
            code: "BASE_TYPE_MAX_LENGTH",
            message: `Must be ${maxCharacters} or fewer in length.`,
        };
    }

    if (body.tts && body.content && body.content.length > maxTTSCharacters) {
        errors.content = {
            code: "BASE_TYPE_MAX_LENGTH",
            message: `TTS messages must be ${maxTTSCharacters} or fewer in length.`,
        };
    }

    if (body.embeds && body.embeds.length > maxEmbeds) {
        errors.embeds = {
            code: "BASE_TYPE_MAX_ITEMS",
            message: `Must contain ${maxEmbeds} or fewer items.`,
        };
    }

    if (Object.keys(errors).length) throw FieldErrors(errors);
}
