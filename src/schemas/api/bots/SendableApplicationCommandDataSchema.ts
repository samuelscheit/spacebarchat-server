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

import { Snowflake } from "../../Identifiers";
import { UploadAttachmentRequestSchema } from "../../uncategorised";
import { ApplicationCommandType } from "./ApplicationCommandSchema";

/**
 * Keep Discord number-command option values as JSON numbers in the generated
 * schema. The repository schema generator defaults TypeScript `number` to
 * JSON-schema `integer`, but submitted command options may contain doubles.
 *
 * @TJS-type number
 */
declare class SendableApplicationCommandInteractionNumberValue {}

interface SendableApplicationCommandInteractionDataOption {
    type: number;
    name: string;
    value?: string | number | boolean | SendableApplicationCommandInteractionNumberValue;
    options?: SendableApplicationCommandInteractionDataOption[];
    focused?: boolean;
}

export interface SendableApplicationCommandDataSchema {
    id: Snowflake;
    type?: ApplicationCommandType;
    name: string;
    version: Snowflake;
    application_command?: object;
    resolved?: object;
    options?: SendableApplicationCommandInteractionDataOption[];
    target_id?: Snowflake;
    attachments?: UploadAttachmentRequestSchema[];
}
