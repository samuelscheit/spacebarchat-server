export interface RecentAvatarResponse {
    id: string;
    storage_hash: string;
    description: string | null;
}

export interface RecentAvatarsResponse {
    avatars: RecentAvatarResponse[];
}
