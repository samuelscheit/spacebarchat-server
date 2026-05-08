import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeChannelName, normalizeGuildChannelName, normalizeThreadName, assertChannelNamePresent } from "./ChannelName";

const GUILD_TEXT = 0;
const GUILD_VOICE = 2;
const GUILD_CATEGORY = 4;
const GUILD_NEWS_THREAD = 10;
const GUILD_PUBLIC_THREAD = 11;
const GUILD_PRIVATE_THREAD = 12;

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

    it("uses thread display-name rules when threads are created through the generic channel path", () => {
        assert.equal(normalizeChannelName(" Ветка обсуждения ", GUILD_NEWS_THREAD, []), "Ветка обсуждения");
        assert.equal(normalizeChannelName(" Thread Name ", GUILD_PUBLIC_THREAD, []), "Thread Name");
        assert.equal(normalizeChannelName(" Private Thread ", GUILD_PRIVATE_THREAD, []), "Private Thread");
    });

    it("rejects invisible characters", () => {
        assert.throws(() => normalizeGuildChannelName("об\u200bщий", GUILD_TEXT, []), /invalid characters/);
        assert.throws(() => normalizeThreadName("об\u200bсуждение", []), /invalid characters/);
    });

    it("rejects control characters in channel and thread display names", () => {
        for (const character of ["\0", "\n", "\r", "\x1b"]) {
            assert.throws(() => normalizeGuildChannelName(`об${character}щий`, GUILD_TEXT, []), /invalid characters/);
            assert.throws(() => normalizeGuildChannelName(`Голос${character}овой`, GUILD_VOICE, []), /invalid characters/);
            assert.throws(() => normalizeThreadName(`об${character}суждение`, []), /invalid characters/);
        }
    });

    it("preserves invalid names when explicitly allowed", () => {
        assert.equal(normalizeGuildChannelName("chat\nroom", GUILD_TEXT, ["ALLOW_INVALID_CHANNEL_NAMES"]), "chat\nroom");
        assert.equal(normalizeThreadName("thread\nname", ["ALLOW_INVALID_CHANNEL_NAMES"]), "thread\nname");
    });

    it("rejects normalized empty names unless unnamed channels are allowed", () => {
        assert.throws(() => assertChannelNamePresent("", []), /cannot be empty/);
        assert.doesNotThrow(() => assertChannelNamePresent("", ["ALLOW_UNNAMED_CHANNELS"]));
    });
});
