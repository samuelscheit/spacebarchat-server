import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { PublicMember } from "@spacebar/schemas";
import type { NewUrlUserSignatureData as NewUrlUserSignatureDataType } from "../Signing";
import type { Member as MemberType } from "./Member";
import type { Message as MessageType } from "./Message";
import type { Role } from "./Role";

let Member: typeof import("./Member").Member;
let Message: typeof import("./Message").Message;
let NewUrlUserSignatureData: typeof import("../Signing").NewUrlUserSignatureData;
let signatureData: NewUrlUserSignatureDataType;

before(async () => {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar-tests";
    ({ Member } = await import("./Member.js"));
    ({ Message } = await import("./Message.js"));
    ({ NewUrlUserSignatureData } = await import("../Signing.js"));
    signatureData = new NewUrlUserSignatureData({ ip: "127.0.0.1", userAgent: "node:test" });
});

function createMemberWithRoles(roles: (string | { id: string })[]) {
    const member = new Member();
    member.id = "user-a";
    member.guild_id = "guild-a";
    member.joined_at = new Date("2026-01-02T03:04:05.000Z");
    member.deaf = false;
    member.mute = false;
    member.pending = false;
    member.roles = roles as unknown as Role[];
    member.flags = 0;
    return member;
}

function createMessageWithMember(member: MemberType) {
    const message = new Message();
    message.id = "message-a";
    message.channel_id = "channel-a";
    message.guild_id = "guild-a";
    message.author_id = "user-a";
    message.member = member;
    message.timestamp = new Date("2026-01-02T03:04:05.000Z");
    message.edited_timestamp = undefined;
    message.type = 0;
    message.content = "hello";
    message.flags = 0;
    message.embeds = [];
    message.reactions = [];
    message.mentions = [];
    message.mention_roles = [];
    message.mention_channels = [];
    message.attachments = [];
    message.components = [];
    message.mention_everyone = false;
    return message;
}

describe("message member serialization", () => {
    test("Member.toPublicMember serializes loaded role entities to role ids", () => {
        const member = createMemberWithRoles([{ id: "role-a" }, { id: "role-b" }]);

        assert.deepEqual(member.toPublicMember().roles, ["role-a", "role-b"]);
        assert.equal(typeof member.toPublicMember().roles[0], "string");
    });

    test("Member.toPublicMember preserves already serialized role ids", () => {
        const member = createMemberWithRoles(["role-a", "role-b"]);

        assert.deepEqual(member.toPublicMember().roles, ["role-a", "role-b"]);
    });

    test("Message.toJSON returns a public member instead of the raw member entity", () => {
        const member = createMemberWithRoles([{ id: "role-a" }, { id: "role-b" }]);
        const message = createMessageWithMember(member);

        const json = message.toJSON();

        assert.notStrictEqual(json.member, member);
        assert.deepEqual(json.member?.roles, ["role-a", "role-b"]);
        assert.equal(typeof json.member?.roles[0], "string");
    });

    test("withSignedAttachments serializes member role entities on message instances", () => {
        const member = createMemberWithRoles([{ id: "role-a" }, { id: "role-b" }]);
        const message = createMessageWithMember(member);

        const signed = message.withSignedAttachments(signatureData);

        assert.deepEqual(signed.member?.roles, ["role-a", "role-b"]);
        assert.equal(typeof signed.member?.roles[0], "string");
    });

    test("withSignedAttachments accepts already-public members from gateway payloads", () => {
        const member: Omit<PublicMember, "user"> = {
            id: "user-a",
            guild_id: "guild-a",
            nick: undefined,
            roles: ["role-a", "role-b"],
            joined_at: new Date("2026-01-02T03:04:05.000Z"),
            pending: false,
            deaf: false,
            mute: false,
            premium_since: undefined,
            avatar: undefined,
            banner: "",
            bio: "",
            theme_colors: undefined,
            pronouns: undefined,
            communication_disabled_until: null,
            flags: 0,
        };

        const signed = Message.prototype.withSignedAttachments.call(
            {
                member,
                attachments: [],
                components: [],
            } as unknown as MessageType,
            signatureData,
        );

        assert.deepEqual(signed.member?.roles, ["role-a", "role-b"]);
    });
});
