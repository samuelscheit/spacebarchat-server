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

export const RabbitMqJsonContentType = "application/json";
export const RabbitMqBinaryContentType = "application/octet-stream";

export interface RabbitMqEncodedPayload {
    body: Buffer;
    contentType: string;
}

export function encodeRabbitMqPayload(payload: unknown): RabbitMqEncodedPayload {
    if (Buffer.isBuffer(payload)) {
        return binaryPayload(payload);
    }

    if (payload instanceof Uint8Array) {
        return binaryPayload(Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength));
    }

    if (payload instanceof ArrayBuffer) {
        return binaryPayload(Buffer.from(payload));
    }

    if (ArrayBuffer.isView(payload)) {
        return binaryPayload(Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength));
    }

    return jsonPayload(payload);
}

export function decodeRabbitMqPayload(body: Buffer, contentType?: string | null): unknown {
    const normalizedContentType = normalizeRabbitMqContentType(contentType);

    if (normalizedContentType === RabbitMqBinaryContentType) {
        return body;
    }

    if (!normalizedContentType || isJsonContentType(normalizedContentType)) {
        return JSON.parse(body.toString("utf8"));
    }

    return body;
}

export function normalizeRabbitMqContentType(contentType?: string | null): string | undefined {
    return contentType?.split(";", 1)[0]?.trim().toLowerCase() || undefined;
}

function jsonPayload(payload: unknown): RabbitMqEncodedPayload {
    return {
        body: Buffer.from(JSON.stringify(payload ?? null), "utf8"),
        contentType: RabbitMqJsonContentType,
    };
}

function binaryPayload(body: Buffer): RabbitMqEncodedPayload {
    return {
        body,
        contentType: RabbitMqBinaryContentType,
    };
}

function isJsonContentType(contentType: string) {
    return contentType === RabbitMqJsonContentType || contentType === "text/json" || contentType.endsWith("+json");
}
