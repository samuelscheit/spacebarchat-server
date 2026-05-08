import { HTTPError } from "lambert-server";
import { GuildFeature } from "./GuildFeatures";
import { InvisibleCharacters } from "./InvisibleCharacters";

const DISPLAY_NAME_CHANNEL_TYPES = new Set<number>([
    2, // GUILD_VOICE
    4, // GUILD_CATEGORY
    13, // GUILD_STAGE_VOICE
]);

const THREAD_CHANNEL_TYPES = new Set<number>([
    10, // GUILD_NEWS_THREAD
    11, // GUILD_PUBLIC_THREAD
    12, // GUILD_PRIVATE_THREAD
]);

const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;

export function normalizeChannelName(name: string | undefined, type: number | undefined, features: readonly GuildFeature[]): string | undefined {
    if (usesThreadNameRules(type)) return normalizeThreadName(name, features);

    return normalizeGuildChannelName(name, type, features);
}

export function normalizeGuildChannelName(name: string | undefined, type: number | undefined, features: readonly GuildFeature[]): string | undefined {
    if (!name || features.includes(GuildFeature.AllowInvalidChannelNames)) return name;

    assertNoInvalidChannelNameCharacters(name);

    if (usesDisplayNameRules(type, features)) return name.trim();

    return name.trim().toLocaleLowerCase().replace(/\s+/gu, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function normalizeThreadName(name: string | undefined, features: readonly GuildFeature[]): string | undefined {
    if (!name || features.includes(GuildFeature.AllowInvalidChannelNames)) return name;

    assertNoInvalidChannelNameCharacters(name);
    return name.trim();
}

export function assertChannelNamePresent(name: string | undefined, features: readonly GuildFeature[]) {
    if (!features.includes(GuildFeature.AllowUnnamedChannels) && !name) throw new HTTPError("Channel name cannot be empty.", 403);
}

function assertNoInvalidChannelNameCharacters(name: string) {
    if (CONTROL_CHARACTER_PATTERN.test(name)) throw new HTTPError("Channel name cannot include invalid characters", 403);

    for (const character of InvisibleCharacters) {
        if (name.includes(character)) throw new HTTPError("Channel name cannot include invalid characters", 403);
    }
}

function usesThreadNameRules(type: number | undefined) {
    return type !== undefined && THREAD_CHANNEL_TYPES.has(type);
}

function usesDisplayNameRules(type: number | undefined, features: readonly GuildFeature[]) {
    return !features.includes(GuildFeature.IrcLikeCategoryNames) && type !== undefined && DISPLAY_NAME_CHANNEL_TYPES.has(type);
}
