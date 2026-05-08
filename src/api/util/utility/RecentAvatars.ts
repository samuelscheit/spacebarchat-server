import { deleteFile } from "@spacebar/util";
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

export interface PrunableRecentAvatarRecord {
    id: string;
    storage_hash?: string;
}

type SpacebarUtil = typeof import("@spacebar/util");
type UserRecentAvatarEntity = SpacebarUtil["UserRecentAvatar"];
type UserEntity = SpacebarUtil["User"];

function getUserRecentAvatarEntity(): UserRecentAvatarEntity {
    return require("@spacebar/util").UserRecentAvatar as UserRecentAvatarEntity;
}

function getUserEntity(): UserEntity {
    return require("@spacebar/util").User as UserEntity;
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

export function getRecentAvatarIdsToPrune(avatars: PrunableRecentAvatarRecord[], limit: number = RECENT_AVATAR_LIMIT): string[] {
    return avatars.slice(limit).map((avatar) => avatar.id);
}

export function getRecentAvatarStorageHashesToDelete(
    avatars: PrunableRecentAvatarRecord[],
    limit: number = RECENT_AVATAR_LIMIT,
    protectedHashes: Iterable<string | null | undefined> = [],
): string[] {
    const retainedHashes = new Set(
        avatars
            .slice(0, limit)
            .map((avatar) => avatar.storage_hash)
            .filter((hash): hash is string => Boolean(hash)),
    );
    for (const hash of protectedHashes) {
        if (hash) retainedHashes.add(hash);
    }
    const hashesToDelete = new Set<string>();

    for (const avatar of avatars.slice(limit)) {
        if (avatar.storage_hash && !retainedHashes.has(avatar.storage_hash)) hashesToDelete.add(avatar.storage_hash);
    }

    return [...hashesToDelete];
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
    await pruneUserRecentAvatars(userId, RECENT_AVATAR_LIMIT, storageHash);

    return avatar;
}

export async function pruneUserRecentAvatars(userId: string, limit: number = RECENT_AVATAR_LIMIT, currentAvatarHash?: string | null): Promise<void> {
    const UserRecentAvatar = getUserRecentAvatarEntity();
    const avatars = await UserRecentAvatar.find({
        where: { user_id: userId },
        order: { id: "DESC" },
        select: { id: true, storage_hash: true },
    });
    const idsToPrune = getRecentAvatarIdsToPrune(avatars, limit);

    if (!idsToPrune.length) return;

    currentAvatarHash ??= await getCurrentUserAvatarHash(userId);
    const storageHashesToDelete = getRecentAvatarStorageHashesToDelete(avatars, limit, [currentAvatarHash]);

    await UserRecentAvatar.delete({
        user_id: userId,
        id: In(idsToPrune),
    });

    await Promise.all(storageHashesToDelete.map((storageHash) => deletePrunedUserAvatar(userId, storageHash)));
}

async function getCurrentUserAvatarHash(userId: string): Promise<string | null | undefined> {
    const User = getUserEntity();
    const user = await User.findOne({
        where: { id: userId },
        select: { avatar: true },
    });

    return user?.avatar;
}

async function deletePrunedUserAvatar(userId: string, storageHash: string): Promise<void> {
    try {
        await deleteFile(`/avatars/${userId}/${storageHash}`);
    } catch (error) {
        console.warn(`[API] Failed to delete pruned recent avatar ${storageHash} for user ${userId}.`, error);
    }
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
