import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ChannelType } from "@spacebar/schemas/api/channels/Channel";
import { getThreadCreationPermission, resolveThreadCreationType, shouldSendThreadCreatedMessage } from "./ThreadCreationPermissions";

describe("thread creation permission utilities", () => {
    const textParent = { threadOnly: () => false };
    const forumParent = { threadOnly: () => true };
    const textAnnouncementParent = { isForum: () => false };
    const forumAnnouncementParent = { isForum: () => true };

    test("defaults omitted text-channel thread creation to private threads", () => {
        assert.equal(resolveThreadCreationType({}, textParent), ChannelType.GUILD_PRIVATE_THREAD);
    });

    test("defaults omitted forum/media thread creation to public threads", () => {
        assert.equal(resolveThreadCreationType({}, forumParent), ChannelType.GUILD_PUBLIC_THREAD);
    });

    test("respects explicit public and private thread types regardless of parent default", () => {
        assert.equal(resolveThreadCreationType({ type: ChannelType.GUILD_PUBLIC_THREAD }, textParent), ChannelType.GUILD_PUBLIC_THREAD);
        assert.equal(resolveThreadCreationType({ type: ChannelType.GUILD_PRIVATE_THREAD }, forumParent), ChannelType.GUILD_PRIVATE_THREAD);
    });

    test("maps resolved thread types to their required creation permission", () => {
        assert.equal(getThreadCreationPermission(ChannelType.GUILD_PUBLIC_THREAD), "CREATE_PUBLIC_THREADS");
        assert.equal(getThreadCreationPermission(ChannelType.GUILD_PRIVATE_THREAD), "CREATE_PRIVATE_THREADS");
    });

    test("uses resolved private default to suppress parent thread-created messages", () => {
        const threadType = resolveThreadCreationType({}, textParent);

        assert.equal(threadType, ChannelType.GUILD_PRIVATE_THREAD);
        assert.equal(shouldSendThreadCreatedMessage(threadType, textAnnouncementParent), false);
    });

    test("only public text-channel threads send parent thread-created messages", () => {
        assert.equal(shouldSendThreadCreatedMessage(ChannelType.GUILD_PUBLIC_THREAD, textAnnouncementParent), true);
        assert.equal(shouldSendThreadCreatedMessage(ChannelType.GUILD_PUBLIC_THREAD, forumAnnouncementParent), false);
        assert.equal(shouldSendThreadCreatedMessage(ChannelType.GUILD_PRIVATE_THREAD, textAnnouncementParent), false);
    });
});
