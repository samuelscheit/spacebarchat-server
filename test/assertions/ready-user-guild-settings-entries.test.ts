import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReadyUserGuildSettingsEntries as LegacyReadyUserGuildSettingsEntries } from "../../src/util/dtos/ReadyGuildDTO";
import type { ReadyUserGuildSettingsEntries as DirectReadyUserGuildSettingsEntries } from "../../src/util/interfaces/ReadyUserGuildSettingsEntries";
import type { ChannelOverride, UserGuildSettings } from "@spacebar/schemas";
import type { ReadyEventData, ReadyUserGuildSettingsEntries as RootReadyUserGuildSettingsEntries } from "@spacebar/util";

type SchemaReadyUserGuildSettingsEntries = Omit<UserGuildSettings, "channel_overrides" | "guild_id"> & {
    guild_id: string;
    channel_overrides: (ChannelOverride & { channel_id: string })[];
};

type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;

type _DirectExportMatchesSchema = Assert<Extends<DirectReadyUserGuildSettingsEntries, SchemaReadyUserGuildSettingsEntries>>;
type _SchemaMatchesDirectExport = Assert<Extends<SchemaReadyUserGuildSettingsEntries, DirectReadyUserGuildSettingsEntries>>;
type _RootExportMatchesDirectExport = Assert<Extends<RootReadyUserGuildSettingsEntries, DirectReadyUserGuildSettingsEntries>>;
type _DirectExportMatchesRootExport = Assert<Extends<DirectReadyUserGuildSettingsEntries, RootReadyUserGuildSettingsEntries>>;
type _LegacyDtoExportMatchesDirectExport = Assert<Extends<LegacyReadyUserGuildSettingsEntries, DirectReadyUserGuildSettingsEntries>>;
type _ReadyEventEntriesUseMovedType = Assert<Extends<NonNullable<ReadyEventData["user_guild_settings"]>["entries"][number], DirectReadyUserGuildSettingsEntries>>;
type _ReadyEntryGuildIdIsRequired = Assert<Extends<DirectReadyUserGuildSettingsEntries["guild_id"], string>>;
type _ReadyEntryGuildIdRejectsNull = Assert<Extends<null, DirectReadyUserGuildSettingsEntries["guild_id"]> extends false ? true : false>;

const readyGuildSettingsEntry: DirectReadyUserGuildSettingsEntries = {
    channel_overrides: [
        {
            channel_id: "channel_id",
            message_notifications: 1,
            mute_config: {
                end_time: 0,
                selected_time_window: 0,
            },
            muted: false,
        },
    ],
    flags: 0,
    guild_id: "guild_id",
    hide_muted_channels: false,
    message_notifications: 1,
    mobile_push: true,
    mute_config: null,
    mute_scheduled_events: false,
    muted: false,
    notify_highlights: 0,
    suppress_everyone: false,
    suppress_roles: false,
    version: 1,
};

function asReadyEventEntry(entry: NonNullable<ReadyEventData["user_guild_settings"]>["entries"][number]) {
    return entry;
}

test("ReadyUserGuildSettingsEntries remains the READY event settings entry type", () => {
    const rootExportEntry: RootReadyUserGuildSettingsEntries = readyGuildSettingsEntry;
    const legacyDtoExportEntry: LegacyReadyUserGuildSettingsEntries = rootExportEntry;
    const readyEventEntry = asReadyEventEntry(legacyDtoExportEntry);

    assert.equal(readyEventEntry.channel_overrides[0]?.channel_id, "channel_id");
});
