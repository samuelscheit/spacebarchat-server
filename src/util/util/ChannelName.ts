import { HTTPError } from "lambert-server";
import { InvisibleCharacters } from "./InvisibleCharacters";

const DISPLAY_NAME_CHANNEL_TYPES = new Set<number>([
    2, // GUILD_VOICE
    4, // GUILD_CATEGORY
    13, // GUILD_STAGE_VOICE
]);

export function normalizeGuildChannelName(name: string | undefined, type: number | undefined, features: string[]): string | undefined {
    if (!name || features.includes("ALLOW_INVALID_CHANNEL_NAMES")) return name;

    assertNoInvisibleCharacters(name);

    if (usesDisplayNameRules(type, features)) return name.trim();

    return name.trim().toLocaleLowerCase().replace(/\s+/gu, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function normalizeThreadName(name: string | undefined, features: string[]): string | undefined {
    if (!name || features.includes("ALLOW_INVALID_CHANNEL_NAMES")) return name;

    assertNoInvisibleCharacters(name);
    return name.trim();
}

export function assertChannelNamePresent(name: string | undefined, features: string[]) {
    if (!features.includes("ALLOW_UNNAMED_CHANNELS") && !name) throw new HTTPError("Channel name cannot be empty.", 403);
}

function assertNoInvisibleCharacters(name: string) {
    for (const character of InvisibleCharacters) {
        if (name.includes(character)) throw new HTTPError("Channel name cannot include invalid characters", 403);
    }
}

function usesDisplayNameRules(type: number | undefined, features: string[]) {
    return !features.includes("IRC_LIKE_CATEGORY_NAMES") && type !== undefined && DISPLAY_NAME_CHANNEL_TYPES.has(type);
}
