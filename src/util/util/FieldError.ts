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

import { ErrorObject } from "ajv";

export interface FieldErrorResponse {
    code: number;
    message: string;
    errors: ErrorList;
}

export interface ErrorList {
    _errors?: ErrorContent[];
    [key: string]: ErrorContent[] | ErrorList | undefined;
}
export type ErrorContent = { code: string; message: string };
export type ObjectErrorContent = ErrorList & { _errors: ErrorContent[] };
export type FieldErrorsResult = FieldError & { errors: Record<string, ObjectErrorContent> };

export function makeObjectErrorContent(code: string, message: string): ObjectErrorContent {
    return { _errors: [{ code, message }] };
}

export function FieldErrors(fields: Record<string, { code?: string; message: string }>, errors?: ErrorObject[]): FieldErrorsResult {
    const errorObj: Record<string, ObjectErrorContent> = {};
    for (const [key, { message, code }] of Object.entries(fields)) {
        errorObj[key] = {
            _errors: [
                {
                    message,
                    code: code || "BASE_TYPE_INVALID",
                },
            ],
        };
    }

    return new FieldError(50035, "Invalid Form Body", errorObj, errors) as FieldErrorsResult;
}

export class FieldError extends Error {
    constructor(
        public code: string | number,
        public message: string,
        public errors?: ErrorList,
        public _ajvErrors?: ErrorObject[],
    ) {
        super(message);
    }
}
