import { Application, Channel, Guild, Member, Message, Role, Session, User, Webhook } from "@spacebar/util";

let sequence = 0;

export function nextFixtureId(prefix = "test") {
    sequence += 1;
    return `${prefix}${Date.now()}${sequence}`.slice(0, 32);
}

export function makeUser(overrides: Partial<User> = {}): User {
    return assignEntity(new User(), {
        id: nextFixtureId("user"),
        username: "fixture-user",
        discriminator: "0001",
        desktop: false,
        mobile: false,
        premium: false,
        premium_type: 0,
        bot: false,
        bio: "",
        system: false,
        nsfw_allowed: true,
        mfa_enabled: false,
        webauthn_enabled: false,
        totp_secret: "",
        totp_last_ticket: "",
        created_at: new Date(),
        verified: true,
        disabled: false,
        deleted: false,
        flags: 0,
        public_flags: 0,
        purchased_flags: 0,
        premium_usage_flags: 0,
        rights: "0",
        data: { valid_tokens_since: new Date() },
        fingerprints: [],
        sessions: [],
        relationships: [],
        connected_accounts: [],
        ...overrides,
    });
}

export function makeSession(user: User = makeUser(), overrides: Partial<Session> = {}): Session {
    return assignEntity(new Session(), {
        session_id: nextFixtureId("sess"),
        user_id: user.id,
        user,
        activities: [],
        client_info: {},
        client_status: {},
        status: "offline",
        is_admin_session: false,
        created_at: new Date(),
        ...overrides,
    });
}

export function makeGuild(owner: User = makeUser(), overrides: Partial<Guild> = {}): Guild {
    return assignEntity(new Guild(), {
        id: nextFixtureId("guild"),
        name: "Fixture Guild",
        owner,
        owner_id: owner.id,
        features: [],
        large: false,
        members: [],
        roles: [],
        channels: [],
        emojis: [],
        stickers: [],
        invites: [],
        voice_states: [],
        webhooks: [],
        premium_tier: 0,
        public_updates_channel_id: null,
        unavailable: false,
        welcome_screen: { enabled: false, description: "", welcome_channels: [] },
        widget_enabled: true,
        nsfw: false,
        premium_progress_bar_enabled: false,
        channel_ordering: [],
        discovery_weight: 0,
        discovery_excluded: false,
        ...overrides,
    });
}

export function makeRole(guild: Guild = makeGuild(), overrides: Partial<Role> = {}): Role {
    return assignEntity(new Role(), {
        id: nextFixtureId("role"),
        guild,
        guild_id: guild.id,
        color: 0,
        hoist: false,
        managed: false,
        mentionable: false,
        name: "@everyone",
        permissions: "0",
        position: 0,
        flags: 0,
        colors: { primary_color: 0, secondary_color: undefined, tertiary_color: undefined } as Role["colors"],
        ...overrides,
    });
}

export function makeChannel(guild: Guild = makeGuild(), overrides: Partial<Channel> = {}): Channel {
    return assignEntity(new Channel(), {
        id: nextFixtureId("channel"),
        created_at: new Date(),
        name: "fixture-channel",
        type: 0,
        guild,
        guild_id: guild.id,
        parent_id: null,
        nsfw: false,
        flags: 0,
        permission_overwrites: [],
        messages: [],
        webhooks: [],
        recipients: [],
        thread_members: [],
        ...overrides,
    });
}

export function makeMember(user: User = makeUser(), guild: Guild = makeGuild(user), overrides: Partial<Member> = {}): Member {
    return assignEntity(new Member(), {
        id: user.id,
        user,
        guild,
        guild_id: guild.id,
        roles: [],
        joined_at: new Date(),
        deaf: false,
        mute: false,
        pending: false,
        settings: {} as Member["settings"],
        bio: "",
        communication_disabled_until: null,
        flags: 0,
        ...overrides,
    });
}

export function makeMessage(channel: Channel = makeChannel(), author: User = makeUser(), overrides: Partial<Message> = {}): Message {
    return assignEntity(new Message(), {
        id: nextFixtureId("message"),
        channel,
        channel_id: channel.id,
        guild: channel.guild,
        guild_id: channel.guild_id,
        author,
        author_id: author.id,
        content: "fixture message",
        timestamp: new Date(),
        tts: false,
        mention_everyone: false,
        mentions: [],
        mention_roles: [],
        mention_channels: [],
        attachments: [],
        embeds: [],
        reactions: [],
        type: 0,
        flags: 0,
        components: [],
        message_snapshots: [],
        ...overrides,
    });
}

export function makeWebhook(channel: Channel = makeChannel(), overrides: Partial<Webhook> = {}): Webhook {
    const user = makeUser();
    return assignEntity(new Webhook(), {
        id: nextFixtureId("webhook"),
        type: 1,
        name: "fixture-webhook",
        avatar: "",
        token: nextFixtureId("token"),
        guild: channel.guild,
        guild_id: channel.guild_id,
        channel,
        channel_id: channel.id,
        user,
        user_id: user.id,
        ...overrides,
    });
}

export function makeApplication(owner: User = makeUser(), overrides: Partial<Application> = {}): Application {
    return assignEntity(new Application(), {
        id: nextFixtureId("app"),
        name: "Fixture Application",
        description: "",
        summary: "",
        hook: true,
        bot_public: true,
        bot_require_code_grant: false,
        verify_key: "fixture-verify-key",
        owner,
        flags: 0,
        redirect_uris: [],
        rpc_application_state: 0,
        store_application_state: 1,
        verification_state: 1,
        integration_public: true,
        integration_require_code_grant: false,
        discoverability_state: 1,
        discovery_eligibility_flags: 2240,
        ...overrides,
    });
}

function assignEntity<T extends object>(entity: T, values: Partial<T>): T {
    return Object.assign(entity, values);
}
