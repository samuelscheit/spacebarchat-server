import assert from "node:assert/strict";
import { test } from "node:test";
import {
    GuildScheduledEventEntityType,
    GuildScheduledEventPrivacyLevel,
    GuildScheduledEventRecurrenceRuleFrequency,
    GuildScheduledEventRecurrenceRuleWeekday,
    type GuildScheduledEventResponse,
    GuildScheduledEventStatus,
} from "./GuildScheduledEventResponse";

test("guild scheduled event response enums match Discord API wire values", () => {
    assert.deepEqual(
        {
            privacy_level: GuildScheduledEventPrivacyLevel.GuildOnly,
            status: [GuildScheduledEventStatus.Scheduled, GuildScheduledEventStatus.Active, GuildScheduledEventStatus.Completed, GuildScheduledEventStatus.Canceled],
            entity_type: [
                GuildScheduledEventEntityType.StageInstance,
                GuildScheduledEventEntityType.Voice,
                GuildScheduledEventEntityType.External,
                GuildScheduledEventEntityType.PrimeTime,
            ],
            frequency: [
                GuildScheduledEventRecurrenceRuleFrequency.Yearly,
                GuildScheduledEventRecurrenceRuleFrequency.Monthly,
                GuildScheduledEventRecurrenceRuleFrequency.Weekly,
                GuildScheduledEventRecurrenceRuleFrequency.Daily,
            ],
            weekday: [
                GuildScheduledEventRecurrenceRuleWeekday.Monday,
                GuildScheduledEventRecurrenceRuleWeekday.Tuesday,
                GuildScheduledEventRecurrenceRuleWeekday.Wednesday,
                GuildScheduledEventRecurrenceRuleWeekday.Thursday,
                GuildScheduledEventRecurrenceRuleWeekday.Friday,
                GuildScheduledEventRecurrenceRuleWeekday.Saturday,
                GuildScheduledEventRecurrenceRuleWeekday.Sunday,
            ],
        },
        {
            privacy_level: 2,
            status: [1, 2, 3, 4],
            entity_type: [1, 2, 3, 4],
            frequency: [0, 1, 2, 3],
            weekday: [0, 1, 2, 3, 4, 5, 6],
        },
    );
});

test("guild scheduled event response describes external scheduled event payloads", () => {
    const event = {
        id: "1059954443799498922",
        guild_id: "1046920999469330512",
        channel_id: null,
        creator_id: "787017887877169173",
        name: "Alien meetup",
        description: "Aliens only!",
        scheduled_start_time: "2026-05-09T23:00:00.000Z",
        scheduled_end_time: "2026-05-10T23:00:00.000Z",
        privacy_level: GuildScheduledEventPrivacyLevel.GuildOnly,
        status: GuildScheduledEventStatus.Scheduled,
        entity_type: GuildScheduledEventEntityType.External,
        entity_id: null,
        entity_metadata: {
            location: "somewhere in the ocean",
        },
        recurrence_rule: null,
        guild_scheduled_event_exceptions: [],
    } satisfies GuildScheduledEventResponse;

    assert.equal(event.entity_type, GuildScheduledEventEntityType.External);
    assert.deepEqual(event.entity_metadata, { location: "somewhere in the ocean" });
});
