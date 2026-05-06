/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import test from "node:test";
import type { Message } from "@spacebar/util";
import { toGuildMessagesSearchResult } from "./MessageSearch";

test("toGuildMessagesSearchResult serializes public search messages", () => {
    const author = {
        toPublicUser: () => ({
            id: "100",
            username: "author",
            discriminator: "0001",
            public_flags: 0,
            bio: "",
            bot: false,
            premium_since: "2026-01-01T00:00:00.000Z",
            premium_type: 0,
        }),
    };
    const mentionedUser = {
        toPublicUser: () => ({
            id: "101",
            username: "mentioned",
            discriminator: "0002",
            public_flags: 0,
            bio: "",
            bot: false,
            premium_since: "2026-01-01T00:00:00.000Z",
            premium_type: 0,
        }),
    };

    const message = {
        id: "200",
        type: 0,
        content: undefined,
        channel_id: "300",
        author,
        attachments: [
            {
                toJSON: () => ({
                    id: "400",
                    filename: "file.txt",
                    size: 10,
                    message_id: "200",
                    channel_id: "300",
                    url: "https://cdn.example/file.txt",
                    proxy_url: "https://cdn.example/file.txt",
                }),
            },
        ],
        embeds: [],
        mentions: [mentionedUser],
        mention_roles: [{ id: "500", name: "role" }],
        pinned: false,
        mention_everyone: undefined,
        tts: undefined,
        timestamp: new Date("2026-01-02T03:04:05.000Z"),
        edited_timestamp: null,
        flags: 0,
        components: undefined,
        poll: undefined,
    } as unknown as Message;

    assert.deepEqual(toGuildMessagesSearchResult(message), [
        {
            id: "200",
            type: 0,
            content: "",
            channel_id: "300",
            author: author.toPublicUser(),
            attachments: [{ id: "400", filename: "file.txt", size: 10, url: "https://cdn.example/file.txt", proxy_url: "https://cdn.example/file.txt" }],
            embeds: [],
            mentions: [mentionedUser.toPublicUser()],
            mention_roles: ["500"],
            pinned: false,
            mention_everyone: false,
            tts: false,
            timestamp: "2026-01-02T03:04:05.000Z",
            edited_timestamp: null,
            flags: 0,
            components: undefined,
            poll: undefined,
            hit: true,
        },
    ]);
});

test("toGuildMessagesSearchResult serializes webhook messages without a loaded author relation", () => {
    const message = {
        id: "201",
        type: 0,
        content: "webhook result",
        channel_id: "301",
        author: undefined,
        author_id: undefined,
        webhook_id: "901",
        username: "Webhook Override",
        avatar: "webhook-avatar",
        webhook: {
            id: "901",
            name: "Webhook Default",
            avatar: "default-avatar",
        },
        attachments: [],
        embeds: [],
        mentions: [],
        mention_roles: [],
        pinned: false,
        mention_everyone: false,
        tts: false,
        timestamp: new Date("2026-01-03T03:04:05.000Z"),
        edited_timestamp: null,
        flags: 0,
    } as unknown as Message;

    assert.deepEqual(toGuildMessagesSearchResult(message)[0].author, {
        id: "901",
        username: "Webhook Override",
        discriminator: "0000",
        public_flags: 0,
        bio: "",
        bot: true,
        premium_since: new Date(0),
        premium_type: 0,
        avatar: "webhook-avatar",
    });
});
