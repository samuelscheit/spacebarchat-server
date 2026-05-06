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

import { UploadAttachmentRequestSchema } from "@spacebar/schemas";
import { Snowflake } from "../../Identifiers";

type ModalSubmitComponentData = ModalSubmitActionRowComponentData | ModalSubmitLabelComponentData;

type ModalSubmitInteractiveComponentData = ModalSubmitTextInputComponentData | ModalSubmitSelectComponentData | ModalSubmitCheckboxComponentData;

interface ModalSubmitActionRowComponentData {
    type: 1;
    id?: number;
    components: ModalSubmitInteractiveComponentData[];
}

interface ModalSubmitLabelComponentData {
    type: 18;
    id?: number;
    component: ModalSubmitInteractiveComponentData;
}

interface ModalSubmitTextInputComponentData {
    type: 4;
    id?: number;
    custom_id: string;
    value: string;
}

interface ModalSubmitSelectComponentData {
    type: 3 | 5 | 6 | 7 | 8 | 19 | 21 | 22;
    id?: number;
    custom_id: string;
    values: string[];
}

interface ModalSubmitCheckboxComponentData {
    type: 23;
    id?: number;
    custom_id: string;
    value: boolean;
}

export interface SendableModalSubmitDataSchema {
    id?: Snowflake;
    custom_id: string;
    components: ModalSubmitComponentData[];
    resolved?: object;
    attachments?: UploadAttachmentRequestSchema[];
}
