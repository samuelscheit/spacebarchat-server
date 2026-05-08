import { Config, User, type CdnImageLimitsConfiguration } from "@spacebar/util";
import { HTTPError } from "lambert-server";
import { ANIMATED_IMAGE_MIME_TYPES } from "./ImageRouteHelpers";

export type PremiumStatus = Pick<User, "premium" | "premium_type"> | null | undefined;

export function isAnimatedImageMimeType(mimeType: string | undefined) {
    return !!mimeType && ANIMATED_IMAGE_MIME_TYPES.includes(mimeType);
}

export function hasPremiumForAnimatedImageUpload(user: PremiumStatus) {
    return !!user?.premium || (user?.premium_type ?? 0) > 0;
}

export function assertAnimatedImageUploadAllowed(mimeType: string | undefined, limits: Pick<CdnImageLimitsConfiguration, "allowAnimated">, user?: PremiumStatus) {
    if (!isAnimatedImageMimeType(mimeType)) return;

    switch (limits.allowAnimated) {
        case "always":
            return;
        case "premium":
            if (hasPremiumForAnimatedImageUpload(user)) return;
            throw new HTTPError("Animated image uploads require premium", 403);
        case "never":
            throw new HTTPError("Animated image uploads are disabled", 400);
        default:
            throw new HTTPError("Animated image uploads are disabled", 400);
    }
}

export function getGuildProfileImageLimits(baseUrl: string, cdnConfig = Config.get().cdn) {
    return baseUrl.includes("/banners") ? cdnConfig.limits.banner : cdnConfig.limits.guildAvatar;
}

export async function getPremiumStatusForAnimatedImageUpload(mimeType: string | undefined, limits: Pick<CdnImageLimitsConfiguration, "allowAnimated">, userId: string) {
    if (!isAnimatedImageMimeType(mimeType) || limits.allowAnimated !== "premium") return undefined;

    return User.findOne({
        where: { id: userId },
        select: {
            id: true,
            premium: true,
            premium_type: true,
        },
    });
}
