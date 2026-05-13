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
import type { GuildProductAttachmentDownloadResponse } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";

const routeSnowflakePattern = /^[1-9]\d{16,19}$/;

export const UNKNOWN_GUILD_PRODUCT_ATTACHMENT_ERROR = new ApiError("Unknown Product Attachment", 10046, 404);
export const GUILD_PRODUCT_ATTACHMENT_MISSING_ACCESS_ERROR = new ApiError(DiscordApiErrors.MISSING_ACCESS.message, DiscordApiErrors.MISSING_ACCESS.code, 403);

export interface GuildProductAttachmentDownloadProviderOptions {
    guild_id: string;
    listing_id: string;
    attachment_id: string;
    user_id: string;
}

export interface GuildProductAttachmentDownloadSource {
    guild_id: string;
    listing_id: string;
    attachment_id: string;
    url: string;
}

export type GuildProductAttachmentDownloadProvider = (
    options: GuildProductAttachmentDownloadProviderOptions,
) => GuildProductAttachmentDownloadSource | undefined | Promise<GuildProductAttachmentDownloadSource | undefined>;

export function isGuildProductAttachmentDownloadRouteSnowflake(value: string) {
    return routeSnowflakePattern.test(value);
}

export function getConfiguredGuildProductAttachmentDownload(_options: GuildProductAttachmentDownloadProviderOptions): GuildProductAttachmentDownloadSource | undefined {
    // Spacebar does not currently persist Discord guild product attachment entitlement data or signed download URL state.
    return undefined;
}

function isValidDownloadUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
        return false;
    }
}

function isMatchingDownloadSource(source: GuildProductAttachmentDownloadSource, options: GuildProductAttachmentDownloadProviderOptions): boolean {
    return source.guild_id === options.guild_id && source.listing_id === options.listing_id && source.attachment_id === options.attachment_id && isValidDownloadUrl(source.url);
}

export function toGuildProductAttachmentDownloadResponse(source: GuildProductAttachmentDownloadSource): GuildProductAttachmentDownloadResponse {
    return {
        url: source.url,
    };
}

export async function getGuildProductAttachmentDownload(
    options: GuildProductAttachmentDownloadProviderOptions,
    provider: GuildProductAttachmentDownloadProvider = getConfiguredGuildProductAttachmentDownload,
): Promise<GuildProductAttachmentDownloadResponse> {
    for (const value of [options.guild_id, options.listing_id, options.attachment_id]) {
        if (!isGuildProductAttachmentDownloadRouteSnowflake(value)) throw UNKNOWN_GUILD_PRODUCT_ATTACHMENT_ERROR;
    }

    const download = await provider(options);
    if (!download || !isMatchingDownloadSource(download, options)) throw UNKNOWN_GUILD_PRODUCT_ATTACHMENT_ERROR;

    return toGuildProductAttachmentDownloadResponse(download);
}

export function createGuildProductAttachmentDownloadRouter(provider: GuildProductAttachmentDownloadProvider = getConfiguredGuildProductAttachmentDownload) {
    const router: Router = createRouter({ mergeParams: true });

    router.post(
        "/",
        route({
            summary: "Create Guild Product Attachment Download URL",
            description:
                "Returns a provider-backed signed URL for a purchased guild product attachment. Spacebar does not currently persist Discord guild product attachment entitlement data or signed download URL state, so the default implementation fails closed instead of fabricating downloadable product files.",
            responses: {
                200: {
                    body: "GuildProductAttachmentDownloadResponse",
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
            const { guild_id, listing_id, attachment_id } = req.params as { guild_id: string; listing_id: string; attachment_id: string };
            const download = await getGuildProductAttachmentDownload(
                {
                    guild_id,
                    listing_id,
                    attachment_id,
                    user_id: req.user_id,
                },
                provider,
            );

            return res.status(200).json(download);
        },
    );

    return router;
}

export default createGuildProductAttachmentDownloadRouter();
