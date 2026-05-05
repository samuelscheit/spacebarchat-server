export interface PublicUserSerializable {
    toPublicUser?: () => unknown;
}

export function serializeMessageMentions(mentions: (PublicUserSerializable | null | undefined)[] | null | undefined) {
    return (mentions ?? []).map((user) => {
        if (typeof user?.toPublicUser === "function") return user.toPublicUser();
        return user;
    });
}
