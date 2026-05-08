export enum ThreadMemberFlags {
    NONE = 0,
    HAS_INTERACTED = 1 << 0,
    ALL_MESSAGES = 1 << 1,
    ONLY_MENTIONS = 1 << 2,
    NO_MESSAGES = 1 << 3,
}
