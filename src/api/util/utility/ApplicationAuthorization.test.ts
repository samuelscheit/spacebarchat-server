import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { TeamMemberRole, TeamMemberState } from "../../../schemas/api/developers/Team";
import { DiscordApiErrors } from "../../../util/util/Constants";
import {
    canAccessApplicationAssets,
    canAccessApplicationBranches,
    canAccessApplicationEmojis,
    canAccessApplicationGiftCodeBatches,
    canAccessApplicationOAuth2Authorizations,
    canManageApplicationAssets,
    canManageApplicationCommands,
    requireApplicationAssetAccess,
    requireApplicationAssetManagement,
    requireApplicationBranchAccess,
    requireApplicationCommandManagement,
    requireApplicationEmojiAccess,
    requireApplicationGiftCodeBatchAccess,
    requireApplicationOAuth2AuthorizationAccess,
} from "./ApplicationAuthorization";

describe("application command authorization", () => {
    test("allows the application owner", () => {
        assert.equal(canManageApplicationCommands({ owner: { id: "owner" } }, "owner"), true);
    });

    test("allows the application's bot user", () => {
        assert.equal(
            canManageApplicationCommands(
                {
                    owner: { id: "owner" },
                    bot: { id: "application" },
                },
                "application",
            ),
            true,
        );
    });

    test("allows accepted team admins and developers", () => {
        for (const role of [TeamMemberRole.ADMIN, TeamMemberRole.DEVELOPER]) {
            assert.equal(
                canManageApplicationCommands(
                    {
                        owner: { id: "owner" },
                        team: {
                            members: [
                                {
                                    user_id: "member",
                                    membership_state: TeamMemberState.ACCEPTED,
                                    role,
                                },
                            ],
                        },
                    },
                    "member",
                ),
                true,
            );
        }
    });

    test("allows the team owner", () => {
        assert.equal(
            canManageApplicationCommands(
                {
                    owner: { id: "owner" },
                    team: {
                        owner_user_id: "team-owner",
                        members: [],
                    },
                },
                "team-owner",
            ),
            true,
        );
    });

    test("rejects non-members, invited members, and read-only members", () => {
        const application = {
            owner: { id: "owner" },
            team: {
                members: [
                    {
                        user_id: "invited",
                        membership_state: TeamMemberState.INVITED,
                        role: TeamMemberRole.ADMIN,
                    },
                    {
                        user_id: "read-only",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.READ_ONLY,
                    },
                ],
            },
        };

        assert.equal(canManageApplicationCommands(application, "stranger"), false);
        assert.equal(canManageApplicationCommands(application, "invited"), false);
        assert.equal(canManageApplicationCommands(application, "read-only"), false);
    });

    test("loads owner and team members before allowing access", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: {
                    members: [
                        {
                            user_id: "developer",
                            membership_state: TeamMemberState.ACCEPTED,
                            role: TeamMemberRole.DEVELOPER,
                        },
                    ],
                },
            })),
        };

        await requireApplicationCommandManagement("app", "developer", repository);

        assert.deepEqual(repository.findOne.mock.calls[0].arguments[0], {
            where: { id: "app" },
            relations: {
                owner: true,
                bot: true,
                team: {
                    members: true,
                },
            },
        });
    });

    test("loads the application bot before allowing bot-token access", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                bot: { id: "app" },
            })),
        };

        await requireApplicationCommandManagement("app", "app", repository);

        assert.deepEqual(repository.findOne.mock.calls[0].arguments[0], {
            where: { id: "app" },
            relations: {
                owner: true,
                bot: true,
                team: {
                    members: true,
                },
            },
        });
    });

    test("throws the application authorization error for unauthorized callers", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        await assert.rejects(
            () => requireApplicationCommandManagement("app", "attacker", repository),
            (error) => error === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION,
        );
    });

    test("does not infer bot access from matching application and user ids without the bot relation", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        await assert.rejects(
            () => requireApplicationCommandManagement("app", "app", repository),
            (error) => error === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION,
        );
    });

    test("throws the unknown application error for missing applications", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        await assert.rejects(
            () => requireApplicationCommandManagement("missing-app", "user", repository),
            (error) => error === DiscordApiErrors.UNKNOWN_APPLICATION,
        );
    });
});

describe("application gift code batch authorization", () => {
    test("allows the application owner", () => {
        assert.equal(canAccessApplicationGiftCodeBatches({ owner: { id: "owner" } }, "owner"), true);
    });

    test("allows accepted team members with any team role", () => {
        for (const role of [TeamMemberRole.ADMIN, TeamMemberRole.DEVELOPER, TeamMemberRole.READ_ONLY]) {
            assert.equal(
                canAccessApplicationGiftCodeBatches(
                    {
                        owner: { id: "owner" },
                        team: {
                            members: [
                                {
                                    user_id: "member",
                                    membership_state: TeamMemberState.ACCEPTED,
                                    role,
                                },
                            ],
                        },
                    },
                    "member",
                ),
                true,
            );
        }
    });

    test("allows the owning team owner", () => {
        assert.equal(
            canAccessApplicationGiftCodeBatches(
                {
                    owner: { id: "owner" },
                    team: {
                        owner_user_id: "team-owner",
                        members: [],
                    },
                },
                "team-owner",
            ),
            true,
        );
    });

    test("does not allow the application bot user or invited team members", () => {
        const application = {
            owner: { id: "owner" },
            bot: { id: "application" },
            team: {
                members: [
                    {
                        user_id: "invited",
                        membership_state: TeamMemberState.INVITED,
                        role: TeamMemberRole.ADMIN,
                    },
                ],
            },
        };

        assert.equal(canAccessApplicationGiftCodeBatches(application, "application"), false);
        assert.equal(canAccessApplicationGiftCodeBatches(application, "invited"), false);
    });

    test("loads owner and team members before allowing batch access", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: {
                    members: [
                        {
                            user_id: "read-only",
                            membership_state: TeamMemberState.ACCEPTED,
                            role: TeamMemberRole.READ_ONLY,
                        },
                    ],
                },
            })),
        };

        await requireApplicationGiftCodeBatchAccess("app", "read-only", repository);

        assert.deepEqual(repository.findOne.mock.calls[0].arguments[0], {
            where: { id: "app" },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });
    });

    test("throws the application authorization error for unauthorized callers", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        await assert.rejects(
            () => requireApplicationGiftCodeBatchAccess("app", "attacker", repository),
            (error) => error === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION,
        );
    });
});

describe("application branch authorization", () => {
    test("uses the same owner and accepted team-member access boundary as developer resources", () => {
        assert.equal(canAccessApplicationBranches({ owner: { id: "owner" } }, "owner"), true);
        assert.equal(
            canAccessApplicationBranches(
                {
                    owner: { id: "owner" },
                    team: {
                        members: [
                            {
                                user_id: "member",
                                membership_state: TeamMemberState.ACCEPTED,
                                role: TeamMemberRole.READ_ONLY,
                            },
                        ],
                    },
                },
                "member",
            ),
            true,
        );
    });

    test("does not allow application bot users or invited team members", () => {
        const application = {
            owner: { id: "owner" },
            bot: { id: "application" },
            team: {
                members: [
                    {
                        user_id: "invited",
                        membership_state: TeamMemberState.INVITED,
                        role: TeamMemberRole.ADMIN,
                    },
                ],
            },
        };

        assert.equal(canAccessApplicationBranches(application, "application"), false);
        assert.equal(canAccessApplicationBranches(application, "invited"), false);
    });

    test("loads owner and team members before allowing branch access", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: {
                    members: [
                        {
                            user_id: "developer",
                            membership_state: TeamMemberState.ACCEPTED,
                            role: TeamMemberRole.DEVELOPER,
                        },
                    ],
                },
            })),
        };

        await requireApplicationBranchAccess("app", "developer", repository);

        assert.deepEqual(repository.findOne.mock.calls[0].arguments[0], {
            where: { id: "app" },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });
    });

    test("throws unknown application for missing applications", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        await assert.rejects(
            () => requireApplicationBranchAccess("missing-app", "user", repository),
            (error) => error === DiscordApiErrors.UNKNOWN_APPLICATION,
        );
    });

    test("throws the application authorization error for unauthorized callers", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        await assert.rejects(
            () => requireApplicationBranchAccess("app", "attacker", repository),
            (error) => error === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION,
        );
    });
});

describe("application OAuth2 authorization access", () => {
    test("uses the same owner and accepted team-member access boundary as developer resources", () => {
        assert.equal(canAccessApplicationOAuth2Authorizations({ owner: { id: "owner" } }, "owner"), true);
        assert.equal(
            canAccessApplicationOAuth2Authorizations(
                {
                    owner: { id: "owner" },
                    team: {
                        members: [
                            {
                                user_id: "member",
                                membership_state: TeamMemberState.ACCEPTED,
                                role: TeamMemberRole.READ_ONLY,
                            },
                        ],
                    },
                },
                "member",
            ),
            true,
        );
    });

    test("does not allow application bot users or invited team members", () => {
        const application = {
            owner: { id: "owner" },
            bot: { id: "application" },
            team: {
                members: [
                    {
                        user_id: "invited",
                        membership_state: TeamMemberState.INVITED,
                        role: TeamMemberRole.ADMIN,
                    },
                ],
            },
        };

        assert.equal(canAccessApplicationOAuth2Authorizations(application, "application"), false);
        assert.equal(canAccessApplicationOAuth2Authorizations(application, "invited"), false);
    });

    test("loads owner and team members before allowing OAuth2 authorization access", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: {
                    members: [
                        {
                            user_id: "developer",
                            membership_state: TeamMemberState.ACCEPTED,
                            role: TeamMemberRole.DEVELOPER,
                        },
                    ],
                },
            })),
        };

        await requireApplicationOAuth2AuthorizationAccess("app", "developer", repository);

        assert.deepEqual(repository.findOne.mock.calls[0].arguments[0], {
            where: { id: "app" },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });
    });

    test("throws unknown application and authorization errors for OAuth2 authorization access", async (t) => {
        const missingRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };
        await assert.rejects(
            () => requireApplicationOAuth2AuthorizationAccess("missing-app", "user", missingRepository),
            (error) => error === DiscordApiErrors.UNKNOWN_APPLICATION,
        );

        const unauthorizedRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };
        await assert.rejects(
            () => requireApplicationOAuth2AuthorizationAccess("app", "attacker", unauthorizedRepository),
            (error) => error === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION,
        );
    });
});

describe("application asset authorization", () => {
    test("allows owners, team owners, and accepted team members to access application assets", async (t) => {
        const application = {
            owner: { id: "owner" },
            team: {
                owner_user_id: "team-owner",
                members: [
                    {
                        user_id: "read-only",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.READ_ONLY,
                    },
                ],
            },
        };
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => application),
        };

        assert.equal(canAccessApplicationAssets(application, "owner"), true);
        assert.equal(canAccessApplicationAssets(application, "team-owner"), true);
        assert.equal(canAccessApplicationAssets(application, "read-only"), true);
        await requireApplicationAssetAccess("app", "read-only", repository);

        assert.deepEqual(repository.findOne.mock.calls[0].arguments[0], {
            where: { id: "app" },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });
    });

    test("rejects invited members, non-members, and unknown applications for asset access", async (t) => {
        const application = {
            owner: { id: "owner" },
            team: {
                members: [
                    {
                        user_id: "invited",
                        membership_state: TeamMemberState.INVITED,
                        role: TeamMemberRole.ADMIN,
                    },
                ],
            },
        };

        assert.equal(canAccessApplicationAssets(application, "invited"), false);
        assert.equal(canAccessApplicationAssets(application, "attacker"), false);
        await assert.rejects(
            () => requireApplicationAssetAccess("app", "attacker", { findOne: t.mock.fn(async (_options: unknown) => application) }),
            (error) => error === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION,
        );
        await assert.rejects(
            () => requireApplicationAssetAccess("missing-app", "owner", { findOne: t.mock.fn(async (_options: unknown) => null) }),
            (error) => error === DiscordApiErrors.UNKNOWN_APPLICATION,
        );
    });

    test("allows owners and application-management team members to manage application assets", () => {
        assert.equal(canManageApplicationAssets({ owner: { id: "owner" } }, "owner"), true);

        for (const role of [TeamMemberRole.ADMIN, TeamMemberRole.DEVELOPER]) {
            assert.equal(
                canManageApplicationAssets(
                    {
                        owner: { id: "owner" },
                        team: {
                            members: [
                                {
                                    user_id: "manager",
                                    membership_state: TeamMemberState.ACCEPTED,
                                    role,
                                },
                            ],
                        },
                    },
                    "manager",
                ),
                true,
            );
        }
    });

    test("rejects bot users, read-only team members, invited members, and non-members", () => {
        const application = {
            owner: { id: "owner" },
            bot: { id: "application" },
            team: {
                members: [
                    {
                        user_id: "invited",
                        membership_state: TeamMemberState.INVITED,
                        role: TeamMemberRole.ADMIN,
                    },
                    {
                        user_id: "read-only",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.READ_ONLY,
                    },
                ],
            },
        };

        assert.equal(canManageApplicationAssets(application, "application"), false);
        assert.equal(canManageApplicationAssets(application, "read-only"), false);
        assert.equal(canManageApplicationAssets(application, "invited"), false);
        assert.equal(canManageApplicationAssets(application, "attacker"), false);
    });

    test("loads owner and team members before allowing asset management", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: {
                    owner_user_id: "team-owner",
                    members: [
                        {
                            user_id: "developer",
                            membership_state: TeamMemberState.ACCEPTED,
                            role: TeamMemberRole.DEVELOPER,
                        },
                    ],
                },
            })),
        };

        await requireApplicationAssetManagement("app", "developer", repository);

        assert.deepEqual(repository.findOne.mock.calls[0].arguments[0], {
            where: { id: "app" },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });
    });

    test("throws unknown application and authorization errors for asset management", async (t) => {
        const missingRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };
        await assert.rejects(
            () => requireApplicationAssetManagement("missing-app", "user", missingRepository),
            (error) => error === DiscordApiErrors.UNKNOWN_APPLICATION,
        );

        const unauthorizedRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };
        await assert.rejects(
            () => requireApplicationAssetManagement("app", "attacker", unauthorizedRepository),
            (error) => error === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION,
        );
    });
});

describe("application emoji authorization", () => {
    test("allows the application bot user", () => {
        assert.equal(
            canAccessApplicationEmojis(
                {
                    owner: { id: "owner" },
                    bot: { id: "application" },
                },
                "application",
            ),
            true,
        );
    });

    test("allows owners and application-management team members to access application emojis", () => {
        assert.equal(canAccessApplicationEmojis({ owner: { id: "owner" } }, "owner"), true);

        for (const role of [TeamMemberRole.ADMIN, TeamMemberRole.DEVELOPER]) {
            assert.equal(
                canAccessApplicationEmojis(
                    {
                        owner: { id: "owner" },
                        team: {
                            members: [
                                {
                                    user_id: "manager",
                                    membership_state: TeamMemberState.ACCEPTED,
                                    role,
                                },
                            ],
                        },
                    },
                    "manager",
                ),
                true,
            );
        }
    });

    test("rejects non-members, invited team members, and read-only team members", () => {
        const application = {
            owner: { id: "owner" },
            team: {
                members: [
                    {
                        user_id: "invited",
                        membership_state: TeamMemberState.INVITED,
                        role: TeamMemberRole.ADMIN,
                    },
                    {
                        user_id: "read-only",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.READ_ONLY,
                    },
                ],
            },
        };

        assert.equal(canAccessApplicationEmojis(application, "attacker"), false);
        assert.equal(canAccessApplicationEmojis(application, "invited"), false);
        assert.equal(canAccessApplicationEmojis(application, "read-only"), false);
    });

    test("loads owner, bot, and team members before allowing emoji access", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                bot: { id: "app-bot" },
            })),
        };

        await requireApplicationEmojiAccess("app", "app-bot", repository);

        assert.deepEqual(repository.findOne.mock.calls[0].arguments[0], {
            where: { id: "app" },
            relations: {
                owner: true,
                bot: true,
                team: {
                    members: true,
                },
            },
        });
    });

    test("throws unknown application for missing applications", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        await assert.rejects(
            () => requireApplicationEmojiAccess("missing-app", "user", repository),
            (error) => error === DiscordApiErrors.UNKNOWN_APPLICATION,
        );
    });

    test("throws the application authorization error for unauthorized callers", async (t) => {
        const repository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };

        await assert.rejects(
            () => requireApplicationEmojiAccess("app", "attacker", repository),
            (error) => error === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION,
        );
    });
});
