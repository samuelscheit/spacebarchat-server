import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Channel, Guild, Member, User } from "@spacebar/util";
import { HTTPError } from "lambert-server";
import { deleteAdminChannel, forceJoinAdminGuild } from "./mutations";
import { AdminChannelType, assertAdminChannelDeletionSupported, createAdminThreadDeleteEvent, parseAdminDiscoveryGuildUpdate, parseAdminForceJoinInput } from "./mutationPolicy";
import { requireAdminActionSafety, stripAdminActionSafetyFields, unwrapAdminActionPayload } from "./safety";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/test";

describe("admin mutation helpers", () => {
    test("requires reason and exact typed confirmation for dangerous actions", () => {
        assert.deepEqual(requireAdminActionSafety({ reason: "cleanup request", confirmation: "123" }, { expectedConfirmation: "123", idempotencyKey: "same" }), {
            reason: "cleanup request",
            confirmation: "123",
            idempotencyKey: "same",
        });
        assert.deepEqual(stripAdminActionSafetyFields({ reason: "cleanup request", confirmation: "123", value: true }), { value: true });
        assert.deepEqual(unwrapAdminActionPayload({ reason: "config change", confirmation: "SAVE CONFIGURATION", values: { gateway: { endpointClient: "wss://example" } } }), {
            gateway: { endpointClient: "wss://example" },
        });
        assert.throws(
            () => requireAdminActionSafety({ confirmation: "123" }, { expectedConfirmation: "123" }),
            (error) => error instanceof HTTPError && error.code === 400,
        );
        assert.throws(
            () => requireAdminActionSafety({ reason: "cleanup request", confirmation: "wrong" }, { expectedConfirmation: "123" }),
            (error) => error instanceof HTTPError && error.code === 400,
        );
    });

    test("parses only supported discovery update fields", () => {
        assert.deepEqual(parseAdminDiscoveryGuildUpdate({ discoveryExcluded: true, discoveryWeight: 7 }), {
            discoveryExcluded: true,
            discoveryWeight: 7,
        });
        assert.deepEqual(parseAdminDiscoveryGuildUpdate({ discovery_excluded: false, discovery_weight: 3 }), {
            discoveryExcluded: false,
            discoveryWeight: 3,
        });

        assert.throws(
            () => parseAdminDiscoveryGuildUpdate({}),
            (error) => error instanceof HTTPError && error.code === 400,
        );
        assert.throws(
            () => parseAdminDiscoveryGuildUpdate({ discoveryWeight: Number.NaN }),
            (error) => error instanceof HTTPError && error.code === 400,
        );
    });

    test("does not silently reinterpret DM deletion as an admin delete", () => {
        assert.throws(
            () => assertAdminChannelDeletionSupported({ type: AdminChannelType.DM } as never),
            (error) => error instanceof HTTPError && error.code === 400,
        );
        assert.throws(
            () => assertAdminChannelDeletionSupported({ type: AdminChannelType.GROUP_DM } as never),
            (error) => error instanceof HTTPError && error.code === 400,
        );

        assert.doesNotThrow(() => assertAdminChannelDeletionSupported({ type: AdminChannelType.GUILD_TEXT } as never));
    });

    test("builds thread delete events with the gateway payload shape", () => {
        assert.deepEqual(
            createAdminThreadDeleteEvent({
                id: "10",
                guild_id: "20",
                parent_id: "30",
                type: AdminChannelType.GUILD_PUBLIC_THREAD,
            } as never),
            {
                event: "THREAD_DELETE",
                data: {
                    id: "10",
                    guild_id: "20",
                    parent_id: "30",
                    type: AdminChannelType.GUILD_PUBLIC_THREAD,
                },
                guild_id: "20",
            },
        );
    });

    test("deletes guild channels through the channel entity and emits CHANNEL_DELETE", async () => {
        const originalFindOne = Channel.findOne;
        const originalDeleteChannel = Channel.deleteChannel;
        const channel = {
            id: "10",
            guild_id: "20",
            type: AdminChannelType.GUILD_TEXT,
            isThread: () => false,
            toJSON: () => ({ id: "10", guild_id: "20", type: AdminChannelType.GUILD_TEXT }),
        } as never;
        const events: unknown[] = [];
        let deletedChannelId: string | null = null;

        try {
            Channel.findOne = (async () => channel) as typeof Channel.findOne;
            Channel.deleteChannel = (async (deleted: Channel) => {
                deletedChannelId = deleted.id;
            }) as typeof Channel.deleteChannel;

            const result = await deleteAdminChannel("10", async (event) => {
                events.push(event);
            });

            assert.equal(deletedChannelId, "10");
            assert.deepEqual(result, {
                id: "10",
                guildId: "20",
                event: "CHANNEL_DELETE",
                detachedChildChannelIds: [],
            });
            assert.deepEqual(events, [
                {
                    event: "CHANNEL_DELETE",
                    data: { id: "10", guild_id: "20", type: AdminChannelType.GUILD_TEXT },
                    channel_id: "10",
                },
            ]);
        } finally {
            Channel.findOne = originalFindOne;
            Channel.deleteChannel = originalDeleteChannel;
        }
    });

    test("records force-join provenance when an admin adds a missing member", async () => {
        const memberClass = Member as unknown as {
            findOne: (options: unknown) => Promise<unknown>;
            findOneOrFail: (options: unknown) => Promise<unknown>;
            addToGuild: (userId: string, guildId: string, options?: { joined_by?: string }) => Promise<unknown>;
        };
        const guildClass = Guild as unknown as { findOne: (options: unknown) => Promise<unknown> };
        const userClass = User as unknown as { findOne: (options: unknown) => Promise<unknown> };
        const originalMemberFindOne = memberClass.findOne;
        const originalMemberFindOneOrFail = memberClass.findOneOrFail;
        const originalMemberAddToGuild = memberClass.addToGuild;
        const originalGuildFindOne = guildClass.findOne;
        const originalUserFindOne = userClass.findOne;
        const addCalls: { userId: string; guildId: string; options?: { joined_by?: string } }[] = [];
        let memberLookupCount = 0;

        try {
            guildClass.findOne = async () => ({ id: "guild-id", owner_id: "owner-id", save: async () => undefined });
            userClass.findOne = async () => ({ id: "target-user-id" });
            memberClass.findOne = async () => {
                memberLookupCount += 1;
                return null;
            };
            memberClass.addToGuild = async (userId, guildId, options) => {
                addCalls.push({ userId, guildId, options });
            };
            memberClass.findOneOrFail = async () => ({ id: "target-user-id", guild_id: "guild-id", roles: [] });

            const result = await forceJoinAdminGuild("guild-id", { userId: "target-user-id" }, "actor-user-id");

            assert.equal(memberLookupCount, 1);
            assert.deepEqual(addCalls, [{ userId: "target-user-id", guildId: "guild-id", options: { joined_by: "actor-user-id" } }]);
            assert.deepEqual(result, {
                guildId: "guild-id",
                userId: "target-user-id",
                joined: true,
                madeOwner: false,
                madeAdmin: false,
                adminRoleId: null,
            });
        } finally {
            memberClass.findOne = originalMemberFindOne;
            memberClass.findOneOrFail = originalMemberFindOneOrFail;
            memberClass.addToGuild = originalMemberAddToGuild;
            guildClass.findOne = originalGuildFindOne;
            userClass.findOne = originalUserFindOne;
        }
    });

    test("parses force-join options and gives ownership precedence over admin role grants", () => {
        assert.deepEqual(parseAdminForceJoinInput({ userId: " 123 ", makeOwner: true, makeAdmin: true }), {
            userId: "123",
            makeOwner: true,
            makeAdmin: false,
        });
        assert.deepEqual(parseAdminForceJoinInput({ makeAdmin: true }), {
            userId: undefined,
            makeOwner: false,
            makeAdmin: true,
        });
    });
});
