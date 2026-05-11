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
import type { SocialSDKRelease, SocialSDKReleasesResponse } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { type Request, type Response, Router } from "express";

export const UNKNOWN_SOCIAL_SDK_RELEASE = new ApiError("Unknown Social SDK release", 404, 404);

export interface SocialSDKReleaseCatalog {
    releases: readonly SocialSDKRelease[];
    latest_version?: string;
}

export type SocialSDKReleaseCatalogProvider = () => SocialSDKReleaseCatalog;

export function getSocialSDKReleaseCatalog(): SocialSDKReleaseCatalog {
    return {
        releases: [],
        latest_version: "",
    };
}

export function getSocialSDKReleases(releaseCatalogProvider: SocialSDKReleaseCatalogProvider = getSocialSDKReleaseCatalog): SocialSDKReleasesResponse {
    const catalog = releaseCatalogProvider();

    return {
        releases: catalog.releases.map(({ version, release_date_time }) => ({ version, release_date_time })),
        latest_version: catalog.latest_version ?? catalog.releases[0]?.version ?? "",
    };
}

export function getSocialSDKRelease(sdkReleaseVersion: string, releaseCatalogProvider: SocialSDKReleaseCatalogProvider = getSocialSDKReleaseCatalog): SocialSDKRelease | null {
    return releaseCatalogProvider().releases.find((release) => release.version === sdkReleaseVersion) ?? null;
}

export function createSocialSDKReleasesRouter(releaseCatalogProvider: SocialSDKReleaseCatalogProvider = getSocialSDKReleaseCatalog) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Social SDK Releases",
            description: "Returns the currently available social SDK releases.",
            responses: {
                200: {
                    body: "SocialSDKReleasesResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (_req: Request, res: Response) => res.status(200).json(getSocialSDKReleases(releaseCatalogProvider)),
    );

    router.get(
        "/:sdk_release_version",
        route({
            summary: "Get Social SDK Release",
            description: "Returns a social SDK release object for the given version.",
            responses: {
                200: {
                    body: "SocialSDKRelease",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const release = getSocialSDKRelease(req.params.sdk_release_version as string, releaseCatalogProvider);
            if (!release) throw UNKNOWN_SOCIAL_SDK_RELEASE;

            return res.status(200).json(release);
        },
    );

    return router;
}

export default createSocialSDKReleasesRouter();
