import { User, type CdnImageLimitsConfiguration } from "@spacebar/util";
import { HTTPError } from "lambert-server";
import { ANIMATED_IMAGE_MIME_TYPES } from "./ImageRouteHelpers";

export type UserPremiumLookup = (userId: string) => Promise<Pick<User, "premium" | "premium_type"> | null>;

export const isAnimatedAvatarMimeType = (mimeType: string | undefined) => !!mimeType && ANIMATED_IMAGE_MIME_TYPES.includes(mimeType);

export function isPremiumUser(user: Pick<User, "premium" | "premium_type"> | null | undefined) {
    return Boolean(user?.premium || (user?.premium_type ?? 0) > 0);
}

export async function assertAnimatedAvatarUploadAllowed({
    allowAnimated,
    mimeType,
    userId,
    lookupUser = (id) => User.findOne({ where: { id }, select: { premium: true, premium_type: true } }),
}: {
    allowAnimated: CdnImageLimitsConfiguration["allowAnimated"];
    mimeType: string | undefined;
    userId?: string;
    lookupUser?: UserPremiumLookup;
}) {
    if (!isAnimatedAvatarMimeType(mimeType)) return;

    if (allowAnimated === "always") return;
    if (allowAnimated === "never") throw new HTTPError("Animated avatars are disabled");
    if (!userId) return;

    const user = await lookupUser(userId);
    if (!isPremiumUser(user)) throw new HTTPError("Animated avatars require premium");
}
