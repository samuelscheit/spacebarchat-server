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

import { hasValidSignature, NewUrlUserSignatureData, UrlSignResult } from "@spacebar/util";
import { timingSafeEqual } from "node:crypto";

export type RequestSignatureHeader = string | string[] | undefined;

export type SignedAttachmentUrlAuth = {
    fullUrl: string;
    ip?: string;
    userAgent?: string;
};

export type AttachmentRequestAuthOptions = SignedAttachmentUrlAuth & {
    signatureHeader: RequestSignatureHeader;
    requestSignature: string;
    cdnSignUrls: boolean;
    validateSignedUrl?: (auth: SignedAttachmentUrlAuth) => boolean;
};

export function hasMatchingRequestSignature(signatureHeader: RequestSignatureHeader, requestSignature: string): boolean {
    if (typeof signatureHeader !== "string" || requestSignature.length === 0) return false;

    const received = Buffer.from(signatureHeader);
    const expected = Buffer.from(requestSignature);

    return received.length === expected.length && timingSafeEqual(received, expected);
}

export function validateAttachmentSignedUrl(auth: SignedAttachmentUrlAuth): boolean {
    try {
        return hasValidSignature(
            new NewUrlUserSignatureData({
                ip: auth.ip,
                userAgent: auth.userAgent,
            }),
            UrlSignResult.fromUrl(auth.fullUrl),
        );
    } catch {
        return false;
    }
}

export function hasValidAttachmentRequestAuth(options: AttachmentRequestAuthOptions): boolean {
    if (hasMatchingRequestSignature(options.signatureHeader, options.requestSignature)) return true;

    if (!options.cdnSignUrls) return true;

    const validateSignedUrl = options.validateSignedUrl ?? validateAttachmentSignedUrl;
    return validateSignedUrl({
        fullUrl: options.fullUrl,
        ip: options.ip,
        userAgent: options.userAgent,
    });
}
