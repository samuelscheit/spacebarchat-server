export interface RecentAvatar {
    id: string;
    storage_hash: string;
    description: string | null;
}

export function getRecentAvatarsFromCurrentAvatar(avatar: string | null | undefined, description: string | null | undefined = null): RecentAvatar[] {
    if (!avatar) return [];

    return [
        {
            id: avatar,
            storage_hash: avatar,
            description: description ?? null,
        },
    ];
}

export function removeAvatarDescription<T extends { avatar_description?: string | null }>(body: T): Omit<T, "avatar_description"> {
    const { avatar_description: _avatarDescription, ...rest } = body;
    return rest;
}
