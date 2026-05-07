import { HTTPError } from "lambert-server";
import { In } from "typeorm";

export const RECENT_AVATAR_LIMIT = 6;

export interface RecentAvatar {
    id: string;
    storage_hash: string;
    description: string | null;
}

export interface RecentAvatarRecord {
    id: string;
    storage_hash: string;
    description?: string | null;
}

type UserRecentAvatarEntity = typeof import("@spacebar/util").UserRecentAvatar;

function getUserRecentAvatarEntity(): UserRecentAvatarEntity {
    return require("@spacebar/util").UserRecentAvatar as UserRecentAvatarEntity;
}

export function toRecentAvatarResponse(avatar: RecentAvatarRecord): RecentAvatar {
    return {
        id: avatar.id,
        storage_hash: avatar.storage_hash,
        description: avatar.description ?? null,
    };
}

export function withCurrentAvatarFallback(avatars: RecentAvatarRecord[], currentAvatar: string | null | undefined, limit: number = RECENT_AVATAR_LIMIT): RecentAvatar[] {
    const response = avatars.map(toRecentAvatarResponse);

    if (currentAvatar && !response.some((avatar) => avatar.storage_hash === currentAvatar)) {
        response.unshift({
            id: currentAvatar,
            storage_hash: currentAvatar,
            description: null,
        });
    }

    return response.slice(0, limit);
}

export function getRecentAvatarIdsToPrune(avatars: RecentAvatarRecord[], limit: number = RECENT_AVATAR_LIMIT): string[] {
    return avatars.slice(limit).map((avatar) => avatar.id);
}

export async function getUserRecentAvatars(userId: string, currentAvatar: string | null | undefined): Promise<RecentAvatar[]> {
    const UserRecentAvatar = getUserRecentAvatarEntity();
    const avatars = await UserRecentAvatar.find({
        where: { user_id: userId },
        order: { id: "DESC" },
        take: RECENT_AVATAR_LIMIT,
    });

    return withCurrentAvatarFallback(avatars, currentAvatar);
}

export async function recordUserRecentAvatar(userId: string, storageHash: string, description: string | null | undefined): Promise<RecentAvatarRecord> {
    const UserRecentAvatar = getUserRecentAvatarEntity();
    const avatar = UserRecentAvatar.create({
        user_id: userId,
        storage_hash: storageHash,
        description: description ?? null,
    });

    await avatar.save();
    await pruneUserRecentAvatars(userId);

    return avatar;
}

export async function pruneUserRecentAvatars(userId: string, limit: number = RECENT_AVATAR_LIMIT): Promise<void> {
    const UserRecentAvatar = getUserRecentAvatarEntity();
    const avatars = await UserRecentAvatar.find({
        where: { user_id: userId },
        order: { id: "DESC" },
        select: { id: true },
    });
    const idsToPrune = getRecentAvatarIdsToPrune(avatars, limit);

    if (!idsToPrune.length) return;

    await UserRecentAvatar.delete({
        user_id: userId,
        id: In(idsToPrune),
    });
}

export async function getUserRecentAvatarHash(userId: string, avatarId: string): Promise<string> {
    const UserRecentAvatar = getUserRecentAvatarEntity();
    const avatar = await UserRecentAvatar.findOne({
        where: {
            id: avatarId,
            user_id: userId,
        },
        select: {
            storage_hash: true,
        },
    });

    if (!avatar) throw new HTTPError("Unknown avatar", 404);

    return avatar.storage_hash;
}
