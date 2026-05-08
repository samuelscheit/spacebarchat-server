import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { PartialUser } from "@spacebar/schemas";
import { messageToPublicMessage } from "../../src/util/util/MessagePublic";

function makePublicUser(): PartialUser {
    return {
        id: "300",
        username: "alice",
        discriminator: "0001",
        avatar: null,
    };
}

test("legacy message interaction users are projected to public user fields", () => {
    const publicUser = makePublicUser();
    const publicMessage = messageToPublicMessage({
        id: "201",
        channel_id: "100",
        content: "hello",
        timestamp: new Date("2026-05-06T00:00:00.000Z"),
        edited_timestamp: null,
        mentions: [],
        mention_roles: [],
        mention_channels: [],
        attachments: [],
        embeds: [],
        pinned: false,
        type: 20,
        flags: 0,
        components: [],
        interaction: {
            id: "900",
            type: 2,
            name: "command",
            user: {
                id: publicUser.id,
                username: publicUser.username,
                discriminator: publicUser.discriminator,
                email: "private@example.invalid",
                phone: "private-phone",
                verified: true,
            },
        },
        author: {
            ...makePublicUser(),
            toPublicUser: makePublicUser,
        },
    });

    assert.deepEqual(publicMessage.interaction, {
        id: "900",
        type: 2,
        name: "command",
        user: publicUser,
    });
});

test("interaction callback stores projected interaction users", () => {
    const source = readFileSync(join(process.cwd(), "src/api/routes/interactions/#interaction_id/#interaction_token/callback.ts"), "utf8");

    assert.match(source, /const interactionUser = user\.toPublicUser\(\);/);
    assert.equal(source.match(/user: interactionUser/g)?.length, 2);
});

test("message history hydrates legacy interaction users through the shared partial-user projection", () => {
    const source = readFileSync(join(process.cwd(), "src/api/routes/channels/#channel_id/messages/index.ts"), "utf8");

    assert.match(source, /toMessageMentionUser\(await User\.findOneOrFail/);
    assert.doesNotMatch(source, /toPublicUser\(\) as PartialUser/);
});
