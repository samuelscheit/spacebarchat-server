import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeGuildChannelName, normalizeThreadName, assertChannelNamePresent } from "./ChannelName";

const GUILD_TEXT = 0;
const GUILD_VOICE = 2;
const GUILD_CATEGORY = 4;

describe("channel name validation", () => {
    it("preserves Cyrillic text channel names", () => {
        assert.equal(normalizeGuildChannelName("общий", GUILD_TEXT, []), "общий");
    });

    it("normalizes localized text channel names before persistence", () => {
        assert.equal(normalizeGuildChannelName(" Основной чат ", GUILD_TEXT, []), "основной-чат");
    });

    it("keeps spaces in category, voice, and thread display names", () => {
        assert.equal(normalizeGuildChannelName(" Текстовые каналы ", GUILD_CATEGORY, []), "Текстовые каналы");
        assert.equal(normalizeGuildChannelName(" Голосовой канал ", GUILD_VOICE, []), "Голосовой канал");
        assert.equal(normalizeThreadName(" Ветка обсуждения ", []), "Ветка обсуждения");
    });

    it("rejects invisible characters", () => {
        assert.throws(() => normalizeGuildChannelName("об\u200bщий", GUILD_TEXT, []), /invalid characters/);
        assert.throws(() => normalizeThreadName("об\u200bсуждение", []), /invalid characters/);
    });

    it("rejects normalized empty names unless unnamed channels are allowed", () => {
        assert.throws(() => assertChannelNamePresent("", []), /cannot be empty/);
        assert.doesNotThrow(() => assertChannelNamePresent("", ["ALLOW_UNNAMED_CHANNELS"]));
    });
});
