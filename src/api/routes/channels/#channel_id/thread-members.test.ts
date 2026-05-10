/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2025 Spacebar and Spacebar Contributors

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
import { test } from "node:test";
import { ChannelType } from "@spacebar/schemas";
import { Channel, Member, ThreadMember } from "@spacebar/util";
import { addThreadMember, removeThreadMember } from "./thread-members";

test("PUT /thread-members/@me joins the authenticated user without add-member permissions", async (t) => {
    const originalChannelFindOneOrFail = Channel.findOneOrFail;
    const originalMemberFindOneOrFail = Member.findOneOrFail;
    const originalThreadMemberExistsBy = ThreadMember.existsBy;
    let permissionChecks = 0;
    let memberLookup: unknown;

    t.after(() => {
        Channel.findOneOrFail = originalChannelFindOneOrFail;
        Member.findOneOrFail = originalMemberFindOneOrFail;
        ThreadMember.existsBy = originalThreadMemberExistsBy;
    });

    Channel.findOneOrFail = (async () => ({
        id: "thread-id",
        guild_id: "guild-id",
        guild: { id: "guild-id" },
        getUserPermissions: async () => {
            permissionChecks++;
            throw new Error("self join should not require add-member permissions");
        },
    })) as typeof Channel.findOneOrFail;
    Member.findOneOrFail = (async (options: unknown) => {
        memberLookup = options;
        return { index: "current-member-index" };
    }) as typeof Member.findOneOrFail;
    ThreadMember.existsBy = (async () => true) as typeof ThreadMember.existsBy;

    const res = createResponse();
    await addThreadMember(createRequest({ channel_id: "thread-id" }), res);

    assert.equal(res.statusCode, 204);
    assert.equal(res.sent, true);
    assert.equal(permissionChecks, 0);
    assert.deepEqual(memberLookup, { where: { id: "current-user", guild_id: "guild-id" } });
});

test("DELETE /thread-members/@me removes the authenticated user without manage-thread permissions", async (t) => {
    const originalChannelFindOneOrFail = Channel.findOneOrFail;
    const originalRemoveFromThread = ThreadMember.removeFromThread;
    let permissionChecks = 0;
    let removedUserId: string | undefined;
    let removedThreadId: string | undefined;

    t.after(() => {
        Channel.findOneOrFail = originalChannelFindOneOrFail;
        ThreadMember.removeFromThread = originalRemoveFromThread;
    });

    Channel.findOneOrFail = (async () => ({
        id: "thread-id",
        guild_id: "guild-id",
        type: ChannelType.GUILD_PUBLIC_THREAD,
        getUserPermissions: async () => {
            permissionChecks++;
            throw new Error("self leave should not require manage-thread permissions");
        },
    })) as typeof Channel.findOneOrFail;
    ThreadMember.removeFromThread = (async (userId: string, threadId: string) => {
        removedUserId = userId;
        removedThreadId = threadId;
    }) as typeof ThreadMember.removeFromThread;

    const res = createResponse();
    await removeThreadMember(createRequest({ channel_id: "thread-id" }), res);

    assert.equal(res.statusCode, 204);
    assert.equal(res.sent, true);
    assert.equal(permissionChecks, 0);
    assert.equal(removedUserId, "current-user");
    assert.equal(removedThreadId, "thread-id");
});

function createRequest(params: Record<string, string>) {
    return {
        params,
        user_id: "current-user",
        user: { id: "current-user" },
    } as never;
}

function createResponse() {
    return {
        statusCode: 200,
        sent: false,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        send() {
            this.sent = true;
            return this;
        },
    };
}
