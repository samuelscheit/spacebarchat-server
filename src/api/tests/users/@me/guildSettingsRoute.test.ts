import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { EntityNotFoundError, type FindManyOptions } from "typeorm";
import { Channel } from "@spacebar/util";
import { assertChannelOverridesExist } from "../../../routes/users/@me/guilds/#guild_id/settings.js";

type ChannelFindOptions = FindManyOptions<InstanceType<typeof Channel>>;

const originalChannelFind = Channel.find;
const mute_config = { end_time: 0, selected_time_window: 0 };

afterEach(() => {
    Channel.find = originalChannelFind;
});

function getFindOperatorValue(operator: unknown) {
    assert.equal(typeof operator, "object");
    assert.notEqual(operator, null);

    const typedOperator = operator as { _type?: string; _value?: unknown };
    assert.equal(typedOperator._type, "in");
    return typedOperator._value;
}

describe("assertChannelOverridesExist", () => {
    test("queries all override channel ids in one lookup", async () => {
        const findCalls: ChannelFindOptions[] = [];
        Channel.find = (async (options: ChannelFindOptions) => {
            findCalls.push(options);
            return [{ id: "channel-a" }, { id: "channel-b" }] as InstanceType<typeof Channel>[];
        }) as typeof Channel.find;

        await assertChannelOverridesExist({
            "channel-a": { channel_id: "channel-a", message_notifications: 1, mute_config, muted: false },
            "channel-b": { channel_id: "channel-b", message_notifications: 2, mute_config, muted: true },
        });

        assert.equal(findCalls.length, 1);
        assert.deepEqual(findCalls[0].select, { id: true });
        assert.deepEqual(getFindOperatorValue((findCalls[0].where as { id: unknown }).id), ["channel-a", "channel-b"]);
    });

    test("rejects when any override channel id does not exist", async () => {
        Channel.find = (async () => [{ id: "channel-a" }] as InstanceType<typeof Channel>[]) as typeof Channel.find;

        await assert.rejects(
            () =>
                assertChannelOverridesExist({
                    "channel-a": { channel_id: "channel-a", message_notifications: 1, mute_config, muted: false },
                    missing: { channel_id: "missing", message_notifications: 1, mute_config, muted: false },
                }),
            (error) => {
                assert.equal(error instanceof EntityNotFoundError, true);
                assert.match((error as EntityNotFoundError).message, /missing/);
                return true;
            },
        );
    });

    test("does not query when no override ids are present", async () => {
        let findCalled = false;
        Channel.find = (async () => {
            findCalled = true;
            return [];
        }) as typeof Channel.find;

        await assertChannelOverridesExist({});

        assert.equal(findCalled, false);
    });
});
