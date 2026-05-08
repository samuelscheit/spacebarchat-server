import assert from "node:assert/strict";
import { test } from "node:test";
import { getDatabase } from "@spacebar/util";
import { makeApplication, makeChannel, makeGuild, makeMember, makeMessage, makeRole, makeSession, makeUser, makeWebhook } from "./entities";

test("entity fixtures build linked unsaved domain objects without a database", () => {
    assert.equal(getDatabase(), null);

    const owner = makeUser({ username: "owner" });
    const session = makeSession(owner);
    const guild = makeGuild(owner);
    const role = makeRole(guild, { name: "moderator" });
    const channel = makeChannel(guild);
    const member = makeMember(owner, guild, { roles: [role] });
    const message = makeMessage(channel, owner);
    const webhook = makeWebhook(channel);
    const application = makeApplication(owner);

    assert.equal(session.user_id, owner.id);
    assert.equal(guild.owner_id, owner.id);
    assert.equal(role.guild_id, guild.id);
    assert.equal(channel.guild_id, guild.id);
    assert.equal(member.guild_id, guild.id);
    assert.equal(message.channel_id, channel.id);
    assert.equal(webhook.channel_id, channel.id);
    assert.equal(application.owner.id, owner.id);
});
