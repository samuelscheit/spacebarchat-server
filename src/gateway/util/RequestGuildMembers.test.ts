import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { MAX_FILTERED_GUILD_MEMBERS_REQUEST, normalizeGuildMembersRequestLimit } from "./RequestGuildMembers";

describe("normalizeGuildMembersRequestLimit", () => {
    test("keeps full member-list requests unbounded when no filter is present", () => {
        assert.equal(normalizeGuildMembersRequestLimit(undefined, undefined, undefined), undefined);
        assert.equal(normalizeGuildMembersRequestLimit(undefined, [], 0), 0);
    });

    test("clamps filtered username searches to the gateway protocol cap", () => {
        assert.equal(normalizeGuildMembersRequestLimit("space", undefined, undefined), MAX_FILTERED_GUILD_MEMBERS_REQUEST);
        assert.equal(normalizeGuildMembersRequestLimit("space", undefined, 500), MAX_FILTERED_GUILD_MEMBERS_REQUEST);
    });

    test("clamps user id lookups to the gateway protocol cap", () => {
        assert.equal(normalizeGuildMembersRequestLimit(undefined, ["user-1"], undefined), MAX_FILTERED_GUILD_MEMBERS_REQUEST);
        assert.equal(normalizeGuildMembersRequestLimit(undefined, ["user-1"], 500), MAX_FILTERED_GUILD_MEMBERS_REQUEST);
    });

    test("preserves explicit filtered limits within the protocol cap", () => {
        assert.equal(normalizeGuildMembersRequestLimit("space", undefined, 25), 25);
        assert.equal(normalizeGuildMembersRequestLimit(undefined, ["user-1"], 5), 5);
        assert.equal(normalizeGuildMembersRequestLimit("space", undefined, MAX_FILTERED_GUILD_MEMBERS_REQUEST), MAX_FILTERED_GUILD_MEMBERS_REQUEST);
    });
});
