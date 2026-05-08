process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar-test";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const util = require("@spacebar/util");
const { getWidgetJsonData } = require("./#guild_id/widget.json") as typeof import("./#guild_id/widget.json");

type InviteRecord = InstanceType<typeof util.Invite> & {
    code: string;
    guild_id: string;
    channel_id: string;
};

const originalMethods = {
    channelGetOrderedChannels: util.Channel.getOrderedChannels,
    guildFindOneOrFail: util.Guild.findOneOrFail,
    inviteFindOne: util.Invite.findOne,
    inviteSave: util.Invite.prototype.save,
    memberFind: util.Member.find,
};

afterEach(() => {
    util.Channel.getOrderedChannels = originalMethods.channelGetOrderedChannels;
    util.Guild.findOneOrFail = originalMethods.guildFindOneOrFail;
    util.Invite.findOne = originalMethods.inviteFindOne;
    util.Invite.prototype.save = originalMethods.inviteSave;
    util.Member.find = originalMethods.memberFind;
});

function createInvite(overrides: Partial<InviteRecord> = {}) {
    const invite = new util.Invite() as InviteRecord;
    Object.assign(invite, {
        code: "invite-code",
        guild_id: "guild-id",
        channel_id: "channel-id",
        ...overrides,
    });
    return invite;
}

test("widget invite generation retries global code collisions", async () => {
    const invites = [
        createInvite({
            code: "taken1",
            guild_id: "other-guild",
            channel_id: "other-channel",
        }),
    ];
    const generatedCodes = ["taken1", "fresh1"];

    util.Guild.findOneOrFail = async () => ({
        id: "guild-id",
        name: "Guild",
        channel_ordering: [],
        widget_channel_id: "widget-channel",
        widget_enabled: true,
        presence_count: 0,
    });
    util.Invite.findOne = async ({ where }: { where: Partial<InviteRecord> }) =>
        invites.find((invite) => Object.entries(where).every(([key, value]) => invite[key as keyof InviteRecord] === value));
    util.Invite.prototype.save = async function save(this: InviteRecord) {
        invites.push(this);
        return this;
    };
    util.Channel.getOrderedChannels = async () => [];
    util.Member.find = async () => [];

    const response = await getWidgetJsonData("guild-id", {
        generateCode: () => generatedCodes.shift()!,
    });

    assert.equal(response.instant_invite, "fresh1");
    assert.deepEqual(invites.map((invite) => invite.code).sort(), ["fresh1", "taken1"]);
});
