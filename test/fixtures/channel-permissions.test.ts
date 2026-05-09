import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Member, Permissions, Recipient, type Channel } from "@spacebar/util";
import { ChannelType } from "@spacebar/schemas";
import { makeChannel, makeGuild, makeUser } from "./entities";

function dmChannel(fields: Partial<Channel> = {}) {
    const guild = makeGuild();
    return makeChannel(guild, {
        type: ChannelType.DM,
        guild: undefined,
        guild_id: undefined,
        recipients: [],
        ...fields,
    });
}

function recipient(user_id: string, closed = false) {
    return { user_id, closed } as Recipient;
}

function entityNotFoundError() {
    const error = new Error("fixture entity missing");
    error.name = "EntityNotFoundError";
    return error;
}

async function withMemberFindOneOrFailFailure(error: Error, run: () => Promise<void>) {
    const originalFindOneOrFail = Member.findOneOrFail;
    Member.findOneOrFail = (async () => {
        throw error;
    }) as typeof Member.findOneOrFail;

    try {
        await run();
    } finally {
        Member.findOneOrFail = originalFindOneOrFail;
    }
}

async function withRecipientFindOne(result: Recipient | null, run: () => Promise<void>) {
    const originalFindOne = Recipient.findOne;
    Recipient.findOne = (async () => result) as typeof Recipient.findOne;

    try {
        await run();
    } finally {
        Recipient.findOne = originalFindOne;
    }
}

async function captureConsoleError(run: () => Promise<void>) {
    const errors: unknown[][] = [];
    const originalError = console.error;

    try {
        console.error = (...args: unknown[]) => {
            errors.push(args);
        };
        await run();
    } finally {
        console.error = originalError;
    }

    return errors;
}

describe("Channel.canViewChannel", () => {
    test("fails closed when a DM channel has no caller user", async () => {
        const channel = dmChannel();

        const errors = await captureConsoleError(async () => {
            assert.equal(await channel.canViewChannel({}), false);
        });

        assert.deepEqual(errors, [["Channel.getUserPermissions: called without user for DM channel."]]);
    });

    test("allows an open DM recipient identified only by user_id", async () => {
        const channel = dmChannel({
            recipients: [recipient("recipient")],
        });

        assert.equal(await channel.canViewChannel({ user_id: "recipient" }), true);
    });

    test("denies closed or missing DM recipients identified only by user_id", async () => {
        const channel = dmChannel({
            recipients: [recipient("recipient", true)],
        });

        assert.equal(await channel.canViewChannel({ user_id: "recipient" }), false);
        assert.equal(await channel.canViewChannel({ user_id: "outsider" }), false);
    });

    test("fails closed when a DM permission check has no caller user", async () => {
        const channel = dmChannel();

        const errors = await captureConsoleError(async () => {
            assert.equal((await channel.getUserPermissions({})).bitfield, Permissions.NONE.bitfield);
        });

        assert.deepEqual(errors, [["Channel.getUserPermissions: called without user for DM channel."]]);
    });

    test("denies DM permissions to non-recipients", async () => {
        const channel = dmChannel({
            recipients: [recipient("recipient")],
        });

        const permissions = await channel.getUserPermissions({ user_id: "outsider" });

        assert.equal(permissions.has("VIEW_CHANNEL"), false);
        assert.equal(permissions.has("ATTACH_FILES"), false);
    });

    test("resolves DM permissions from the recipient table when recipients are not loaded", async () => {
        const channel = dmChannel({
            recipients: undefined,
        });

        await withRecipientFindOne(recipient("recipient"), async () => {
            const permissions = await channel.getUserPermissions({ user_id: "recipient" });

            assert.equal(permissions.has("VIEW_CHANNEL"), true);
            assert.equal(permissions.has("ATTACH_FILES"), true);
            assert.equal(await channel.canViewChannel({ user_id: "recipient" }), true);
        });
    });

    test("fails closed when a guild channel lacks guild context", async () => {
        const channel = makeChannel(makeGuild(), {
            type: ChannelType.GUILD_TEXT,
            guild: undefined,
            guild_id: undefined,
        });

        const errors = await captureConsoleError(async () => {
            assert.equal(await channel.canViewChannel({ user_id: "user" }), false);
        });

        assert.deepEqual(errors, [["Channel.getUserPermissions: called without guild for non-DM channel."]]);
    });

    test("fails closed when a guild channel lacks user or member context", async () => {
        const owner = makeUser();
        const guild = makeGuild(owner);
        const channel = makeChannel(guild, { type: ChannelType.GUILD_TEXT });

        const errors = await captureConsoleError(async () => {
            assert.equal(await channel.canViewChannel({ guild }), false);
        });

        assert.deepEqual(errors, [["Channel.getUserPermissions: called without user or member for non-DM channel."]]);
    });

    test("allows the guild owner without requiring member context", async () => {
        const owner = makeUser();
        const guild = makeGuild(owner);
        const channel = makeChannel(guild, { type: ChannelType.GUILD_TEXT });

        assert.equal(await channel.canViewChannel({ user_id: owner.id, guild }), true);
    });

    test("fails closed when a guild channel member lookup misses", async () => {
        const owner = makeUser();
        const guild = makeGuild(owner);
        const channel = makeChannel(guild, { type: ChannelType.GUILD_TEXT });

        await withMemberFindOneOrFailFailure(entityNotFoundError(), async () => {
            assert.equal(await channel.canViewChannel({ user_id: "missing-member", guild }), false);
        });
    });

    test("rethrows unexpected guild permission lookup errors", async () => {
        const owner = makeUser();
        const guild = makeGuild(owner);
        const channel = makeChannel(guild, { type: ChannelType.GUILD_TEXT });
        const error = new Error("database unavailable");

        await withMemberFindOneOrFailFailure(error, async () => {
            await assert.rejects(
                () => channel.canViewChannel({ user_id: "member", guild }),
                (thrown) => thrown === error,
            );
        });
    });
});
