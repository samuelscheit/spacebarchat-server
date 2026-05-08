# Route Coverage

## DELETE /channels/{channel_id}/messages/{message_id}

- catalog: DELETE_CHANNELS_CHANNEL_ID_MESSAGES_MESSAGE_ID (src/api/routes/channels/#channel_id/messages/#message_id/index.ts)
- methods: DELETE
- features: message.delete.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: none

## GET /activities/shelf

- methods: GET
- features: voice.deafen_toggle, voice.disconnect.basic, voice.join.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:cb707e915895757ab5f04e6bcded17afdfce1c9e1818ca96a7d99132dcad8c18

## GET /channels/{channel_id}

- catalog: GET_CHANNELS_CHANNEL_ID (src/api/routes/channels/#channel_id/index.ts)
- methods: GET
- features: bootstrap.idle.session, channel.permission.edit, experiments.visible_context, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, navigation.channel_switch, navigation.dm_switch, navigation.guild_switch, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, search.member.basic, settings.guild_notifications, thread.create.basic, voice.deafen_toggle, voice.disconnect.basic, voice.join.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:077b118ece7e4e9000beb16448d707923550ae39c8a977c71392d10d5c09b2af, sha256:155f2dd543f873af7c469929a730ccea5b38c3546ee223c6192c4a7baa78025c, sha256:dc18212ba5bcd0d72abc591a7c7759475ca5d8da0e7aeb5e5ac78425bafb3911, sha256:f83cdcd13e69b2ae9a17e8ecaccbd1e7474749d83a730ce05b8a7f4125a7ce10

## GET /channels/{channel_id}/messages

- catalog: GET_CHANNELS_CHANNEL_ID_MESSAGES (src/api/routes/channels/#channel_id/messages/index.ts)
- methods: GET
- features: bootstrap.idle.session, channel.permission.edit, experiments.visible_context, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, navigation.channel_switch, navigation.guild_switch, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, search.member.basic, search.message.basic, settings.guild_notifications, thread.create.basic, voice.deafen_toggle, voice.disconnect.basic, voice.join.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:08798a4964ace8c47f90170cb45bbbe9083e22b678962d17d4b752de167954b0, sha256:1a1d72ac17cec338aa01575496f3754efde8a8ec24ea875a224b35a5ba914743, sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67, sha256:492c6c95d3c282678a5bd5da7535302465b2447eb51cd362092d42ccd5878bfc, sha256:5fa5680f9d065c731f0be52d9e95ca1f97122b410f673cc4ea93a26b5ab6bb51, sha256:61d83d01ca5ccadb3c054e0e1ab41128e2f5480506a049edff152d99bd4c7090, sha256:62db5ca4052d78f1716258e5b96f76e47789d12974ac0f17fa90d40a24007059, sha256:8366edcb2427c502647dc1aaa20087989c7e9730563a7084a2dacc7981b07f7f, sha256:91ca620f8de166a2ee2f65c16ccfa2d2d3c153f2f6eab406beea5b6f69ca6cf9, sha256:924f1474ca8ae3816f9b7ce9a6de2182e00d54f703f18ad9bd5b39ea11c75f1b, sha256:b74365e5122abd696c32eecdbdd011f5a4ef493d6004350aaaa931a0216444d8, sha256:d32580e7307bf8150d9e8282564cf8fbb25e0f8ce31479d1283276183207a16b, sha256:ea922bd829f358fae1c36dbb82dd71e617001dd1afb27aa150f1b7c5147e43ae, sha256:f4ac9fdc34e0cf59afd716fb7fb180bdc3ab29d937b976f1a07a62364ee71a13

## GET /channels/{channel_id}/voice-history

- methods: GET
- features: voice.deafen_toggle, voice.disconnect.basic, voice.join.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:03c791a2bff466a1f917bc4db83ed31cddd76160e2ce2fe94070faff2bd6e015, sha256:ab05bdec08d241939aa485414fd698fe23a87a889530c241a6a20c5be8d1ca91

## GET /content-inventory/users/@me

- methods: GET
- features: channel.permission.edit, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, thread.create.basic, voice.disconnect.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:86a23debef15cd1a1322a339a451fbe0ac657adc953f2e31c0448330657a2842

## GET /games/detectable/exclusions

- methods: GET
- features: channel.permission.edit, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, thread.create.basic, voice.disconnect.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:038f30c12c43492c20a3f1758a65e95ca82971fc46f99725af85b2176cdf8610

## GET /guilds/{guild_id}/application-command-index

- catalog: GET_GUILDS_GUILD_ID_APPLICATION_COMMAND_INDEX (src/api/routes/guilds/#guild_id/application-command-index.ts)
- methods: GET
- features: message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, read_state.mark_unread, read_state.message_ack, thread.create.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:8cf28dd4520841abe1db5524a7a226727f3119f655256b458cb23c5cbd13df0c

## GET /guilds/{guild_id}/discovery-metadata

- methods: GET
- features: guild.role.edit.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:af4f9adab91192b5828c2db6bd7799efa811620d1cb5d733380fbbb511aa8ba6

## GET /guilds/{guild_id}/entitlements

- methods: GET
- features: bootstrap.idle.session, channel.permission.edit, experiments.visible_context, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, navigation.guild_switch, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, search.member.basic, search.message.basic, settings.guild_notifications, thread.create.basic, voice.deafen_toggle, voice.disconnect.basic, voice.join.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:03c791a2bff466a1f917bc4db83ed31cddd76160e2ce2fe94070faff2bd6e015, sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /guilds/{guild_id}/integrations

- catalog: GET_GUILDS_GUILD_ID_INTEGRATIONS (src/api/routes/guilds/#guild_id/integrations.ts)
- methods: GET
- features: channel.permission.edit, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, navigation.guild_switch, read_state.message_ack, read_state.recent_mentions, search.member.basic, search.message.basic, settings.guild_notifications, thread.create.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:068dd3c92aadb60e2d78392ace887e0ca551334dcc5d20cee51cb24fbf7f17f6

## GET /guilds/{guild_id}/messages/search

- catalog: GET_GUILDS_GUILD_ID_MESSAGES_SEARCH (src/api/routes/guilds/#guild_id/messages/search.ts)
- methods: GET
- features: search.message.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:f3cec789221403a14c8ae4c57c1bf9e3457f5cfe073d05fe8d8dd3688e2bff93

## GET /guilds/{guild_id}/new-member-welcome

- methods: GET
- features: guild.role.edit.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: none

## GET /guilds/{guild_id}/powerups

- methods: GET
- features: guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.upload.attachment, read_state.message_ack, thread.create.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /guilds/{guild_id}/profile

- catalog: GET_GUILDS_GUILD_ID_PROFILE (src/api/routes/guilds/#guild_id/profile.ts)
- methods: GET
- features: guild.role.edit.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:2dc28583377d67c9142a3dcbb18ed60207757050773349d9643c7b51ade6624e

## GET /guilds/{guild_id}/regions

- catalog: GET_GUILDS_GUILD_ID_REGIONS (src/api/routes/guilds/#guild_id/regions.ts)
- methods: GET
- features: channel.permission.edit
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:c19dbb477a86f084455069aa48b9a492fd3d741fbff9e5de1fba43d83293e43b

## GET /guilds/{guild_id}/roles/{role_id}/connections/configuration

- methods: GET
- features: guild.role.edit.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /guilds/{guild_id}/roles/member-counts

- catalog: GET_GUILDS_GUILD_ID_ROLES_MEMBER_COUNTS (src/api/routes/guilds/#guild_id/roles/member-counts.ts)
- methods: GET
- features: guild.role.edit.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:67e843f59cbf357c3a2dc4db429d379a7f4156323c9b6dd0c9ebc5aa6c1fbe0f

## GET /guilds/{guild_id}/templates

- catalog: GET_GUILDS_GUILD_ID_TEMPLATES (src/api/routes/guilds/#guild_id/templates.ts)
- methods: GET
- features: guild.role.edit.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /guilds/{guild_id}/top-emojis

- methods: GET
- features: expressions.picker.basic, message.reaction.add
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:9e69d6a62678f5507373bed709a86e55f678fb5fd93bb9f4d72184a6bd2108ca

## GET /guilds/{guild_id}/top-games

- methods: GET
- features: guild.role.edit.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:a17f93130ae9d522fb65a3e2c91c63c002d0c5fa34173b5a553210d1d82188e5

## GET /partner-sdk/storefront-config

- methods: GET
- features: channel.permission.edit, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, thread.create.basic, voice.disconnect.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:b07133b0287c9006dfebd738f0ded9ed1cf90d5c1aa26f7dba1a89612700725f

## GET /partner-sdk/storefront-eligibility

- methods: GET
- features: expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, read_state.mark_unread, read_state.message_ack, thread.create.basic, voice.disconnect.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:e171040d61ac67f1b8609e1f5a48a208953ecfa6ccb910381017d33b951dec5d

## GET /promotions

- methods: GET
- features: channel.permission.edit, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, navigation.dm_switch, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, thread.create.basic, voice.disconnect.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /quests/@me

- methods: GET
- features: message.delete.basic, message.reaction.add, message.reply.basic, message.upload.attachment, read_state.message_ack
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:6042b3e0f12d958257cc2f5e0e0014ec090041c45ac07a1ccef0cff8c0c5f3c8

## GET /quests/decision

- methods: GET
- features: message.delete.basic, message.reaction.add, message.reply.basic, message.upload.attachment, read_state.message_ack
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:de2cf1cd8dd0ac33cfd9471da28b457bfd51bd689a6f1016b1d87d097a1e0f0e

## GET /quests/get-decisions

- methods: GET
- features: message.reaction.add
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:f9ed08cbc1fed294c531e3423012604efe40bad1edf77c83946cbcac5500390a

## GET /scheduled-maintenances/upcoming.json

- catalog: GET_SCHEDULED_MAINTENANCES_UPCOMING_JSON (src/api/routes/scheduled-maintenances/upcoming.json.ts)
- methods: GET
- features: bootstrap.idle.session, channel.permission.edit, experiments.visible_context, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.send.basic, navigation.channel_switch, settings.guild_notifications, thread.create.basic, voice.deafen_toggle, voice.disconnect.basic, voice.join.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:8b56135b00799c77d735c4fdc631449d82ad476c0e259a590568cfeacdba4eb0

## GET /store/published-listings/skus

- methods: GET
- features: expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, read_state.mark_unread, read_state.message_ack, thread.create.basic, voice.disconnect.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:9861bba2dd083f02fc7bcdcadc2c08e99709f9ffab1c7cbcd1f572d2571ab82b

## GET /users/{user_id}/profile

- catalog: GET_USERS_USER_ID_PROFILE (src/api/routes/users/#user_id/profile.ts)
- methods: GET
- features: expressions.picker.basic, message.reaction.add
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:a8f81006a0c0ee49959b7f92b19dc3adf2f68903b15893646e4cc439cb8bc526

## GET /users/@me/affinities/guilds

- catalog: GET_USERS__ME_AFFINITIES_GUILDS (src/api/routes/users/@me/affinities/guilds.ts)
- methods: GET
- features: bootstrap.idle.session, channel.permission.edit, experiments.visible_context, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, navigation.channel_switch, navigation.dm_switch, navigation.guild_switch, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, search.member.basic, search.message.basic, settings.guild_notifications, thread.create.basic, voice.deafen_toggle, voice.disconnect.basic, voice.join.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:a71a454d2b1e3f4d6b5f705c81756af858d2dffd4cb36c8aaddd238f27010bf2

## GET /users/@me/application-command-index

- methods: GET
- features: message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, read_state.mark_unread, read_state.message_ack, thread.create.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:2567d6311a25c8e3f024c9b206488af8cb85aa598df52ab9452b171e9f614a07, sha256:533eaa5ca6bc75b3fdf6e6273a7e111b6c01018a69cb83c4ff5fb813ab34deba

## GET /users/@me/applications/{application_id}/entitlements

- catalog: GET_USERS__ME_APPLICATIONS_APPLICATION_ID_ENTITLEMENTS (src/api/routes/users/@me/applications/#application_id/entitlements.ts)
- methods: GET
- features: expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, navigation.dm_switch, read_state.mark_unread, read_state.message_ack, thread.create.basic, voice.disconnect.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /users/@me/billing/checkout-recovery

- methods: GET
- features: channel.permission.edit, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, thread.create.basic, voice.disconnect.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:343e5e3408bea653f4a7124bb7e27ae0fa3b7a55a3ac6a12a575b23028888b41

## GET /users/@me/billing/payment-sources

- catalog: GET_USERS__ME_BILLING_PAYMENT_SOURCES (src/api/routes/users/@me/billing/payment-sources.ts)
- methods: GET
- features: channel.permission.edit, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, thread.create.basic, voice.disconnect.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /users/@me/billing/subscriptions

- catalog: GET_USERS__ME_BILLING_SUBSCRIPTIONS (src/api/routes/users/@me/billing/subscriptions.ts)
- methods: GET
- features: channel.permission.edit, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, thread.create.basic, voice.disconnect.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /users/@me/collectibles-marketing

- catalog: GET_USERS__ME_COLLECTIBLES_MARKETING (src/api/routes/users/@me/collectibles-marketing.ts)
- methods: GET
- features: channel.permission.edit, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, thread.create.basic, voice.disconnect.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:9713ac6dba59eed9eeae7beffb5c51d37553ac247d8af1aa05fc165825498086

## GET /users/@me/entitlements

- methods: GET
- features: navigation.dm_switch
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /users/@me/mentions

- catalog: GET_USERS__ME_MENTIONS (src/api/routes/users/@me/mentions.ts)
- methods: GET
- features: read_state.recent_mentions
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /users/@me/mfa/webauthn/credentials

- catalog: GET_USERS__ME_MFA_WEBAUTHN_CREDENTIALS (src/api/routes/users/@me/mfa/webauthn/credentials/index.ts)
- methods: GET
- features: channel.permission.edit, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, thread.create.basic, voice.disconnect.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /users/@me/referrals/eligibility

- methods: GET
- features: navigation.dm_switch
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:3bb88ebf7c7a07d030d70b5d6416732792c9c0f8a69626b5de08a83d57ba8be2

## GET /users/@me/settings-proto/2

- catalog: GET_USERS__ME_SETTINGS_PROTO_2 (src/api/routes/users/@me/settings-proto/2.ts)
- methods: GET
- features: expressions.picker.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, read_state.mark_unread, read_state.message_ack, search.message.basic, thread.create.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:3bc6a58318372b5fb79303310048eb484a1ec86d8517c99814581d1076fc42a9

## GET /users/@me/survey

- methods: GET
- features: bootstrap.idle.session, channel.permission.edit, experiments.visible_context, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, navigation.channel_switch, navigation.dm_switch, navigation.guild_switch, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, search.member.basic, search.message.basic, settings.guild_notifications, thread.create.basic, voice.deafen_toggle, voice.disconnect.basic, voice.join.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:03c791a2bff466a1f917bc4db83ed31cddd76160e2ce2fe94070faff2bd6e015

## GET /users/@me/unclaimed-games

- methods: GET
- features: bootstrap.idle.session, channel.permission.edit, experiments.visible_context, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, navigation.channel_switch, navigation.guild_switch, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, search.member.basic, search.message.basic, settings.guild_notifications, thread.create.basic, voice.deafen_toggle, voice.disconnect.basic, voice.join.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:224ba2de93fabd5dd383fc762f8e714485fae9e856a9ace460f2cd6677257a36

## PATCH /channels/{channel_id}/messages/{message_id}

- catalog: PATCH_CHANNELS_CHANNEL_ID_MESSAGES_MESSAGE_ID (src/api/routes/channels/#channel_id/messages/#message_id/index.ts)
- methods: PATCH
- features: message.edit.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:316dbe44274171ebbf653c8a3a9073c9a660ec4d1b11877f285ac8a64747f419
- response shapes: sha256:51f245f5cebd7ae7bec369f817039b8dfca89655dd5f8e66af96bf06e94dd116

## PATCH /guilds/{guild_id}/roles

- catalog: PATCH_GUILDS_GUILD_ID_ROLES (src/api/routes/guilds/#guild_id/roles/index.ts)
- methods: PATCH
- features: guild.role.edit.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:313b3180965974b7639f86003ebac909379b5db11c7171b56f2ae631d4ea041f
- response shapes: sha256:78a1667c798317e0484e58eab8cdb4b3cad10b6dd94faf2eb420826367827399

## PATCH /guilds/{guild_id}/roles/{role_id}

- catalog: PATCH_GUILDS_GUILD_ID_ROLES_ROLE_ID (src/api/routes/guilds/#guild_id/roles/#role_id/index.ts)
- methods: PATCH
- features: guild.role.edit.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:7c0e1859113de82cd3beb6ab7b08863a43f73a5c41bf2ca28e3d21b603ae2748
- response shapes: sha256:c8e1c03f8ef7e44dfc6b8348a9ff17e030fe8cd8b7a7868ea1e805243a03e6a7

## PATCH /users/@me/guilds/settings

- methods: PATCH
- features: settings.guild_notifications
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:ec98506bc6fa87f67c538ddffd1ab73c7b8e48f95420e8e5eba5c82cb84075a8
- response shapes: sha256:d6a6f6136f03cfcc3b3c53b4012430eace712d2c08033b170213b498fc6836bd

## PATCH /users/@me/settings-proto/2

- catalog: PATCH_USERS__ME_SETTINGS_PROTO_2 (src/api/routes/users/@me/settings-proto/2.ts)
- methods: PATCH
- features: message.pin.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:3bc6a58318372b5fb79303310048eb484a1ec86d8517c99814581d1076fc42a9
- response shapes: sha256:3bc6a58318372b5fb79303310048eb484a1ec86d8517c99814581d1076fc42a9

## POST /channels/{channel_id}/attachments

- catalog: POST_CHANNELS_CHANNEL_ID_ATTACHMENTS (src/api/routes/channels/#channel_id/attachments.ts)
- methods: POST
- features: message.upload.attachment
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:54232e7b801f3fc68b93696405313071fe2a6132eefd6cdd80d0d9cdae92f61f
- response shapes: sha256:bb5772f303a229d1e3a03304d829a4716539088410e2b444c2686f2c614df322

## POST /channels/{channel_id}/messages

- catalog: POST_CHANNELS_CHANNEL_ID_MESSAGES (src/api/routes/channels/#channel_id/messages/index.ts)
- methods: POST
- features: expressions.picker.basic, message.reply.basic, message.send.basic, message.upload.attachment, thread.create.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:82011c80e8e943e58547779a442f0d07e69c103c20a46586be727175aa1d604a, sha256:86516fedf3af9d599c05ead0988677ae5e477a1a12a8fd1e3c6d39a12c7e4236
- response shapes: sha256:a6c15cd7b5edb5f961664e1e274d78124188b9a8519e8319404c31eb807522da, sha256:debd1fd62de0d756f9ed1f3282259ca86c38b3a112cb31b20157292b3fa94d2a

## POST /channels/{channel_id}/messages/{message_id}/ack

- catalog: POST_CHANNELS_CHANNEL_ID_MESSAGES_MESSAGE_ID_ACK (src/api/routes/channels/#channel_id/messages/#message_id/ack.ts)
- methods: POST
- features: read_state.mark_unread, read_state.message_ack
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:0c6ccab096235ad7a8920f5975b36ce854510750c2e4f5f03470777e92ee8a16, sha256:99ed3b349b5d7350f9b178a60a3a8d164108f91d354e7027e4e36eaf9d8ea527
- response shapes: sha256:2414190c027c901163a3adb0241fcb56eda3a7edf2cfa4dd581f5d3938ed3bc8

## POST /channels/{channel_id}/messages/{message_id}/threads

- catalog: POST_CHANNELS_CHANNEL_ID_MESSAGES_MESSAGE_ID_THREADS (src/api/routes/channels/#channel_id/messages/#message_id/threads.ts)
- methods: POST
- features: thread.create.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:28afe38e7c73cfb4703ebc7ca2fbb8bb7403dd6a8633e0aa75aa296c2b2ce07c
- response shapes: sha256:c6c44b34835127a1a25d4c3de2793af79cfe75dbb286f65c540fab88bb09c833

## POST /channels/{channel_id}/typing

- catalog: POST_CHANNELS_CHANNEL_ID_TYPING (src/api/routes/channels/#channel_id/typing.ts)
- methods: POST
- features: message.upload.attachment
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: none

## POST /guilds/{guild_id}/migrate-command-scope

- methods: POST
- features: bootstrap.idle.session, channel.permission.edit, experiments.visible_context, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, navigation.guild_switch, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, search.member.basic, search.message.basic, settings.guild_notifications, thread.create.basic, voice.deafen_toggle, voice.disconnect.basic, voice.join.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:f248e244bf1528c3a9e627b6c71fd5b02fc0f9f265f60cbe5b87fba10c6b46ed

## POST /science

- catalog: POST_SCIENCE (src/api/routes/science.ts)
- methods: POST
- features: bootstrap.idle.session, channel.permission.edit, experiments.visible_context, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, navigation.channel_switch, navigation.dm_switch, navigation.guild_switch, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, search.member.basic, search.message.basic, settings.guild_notifications, thread.create.basic, voice.deafen_toggle, voice.disconnect.basic, voice.join.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:03977fcee8f70d6da9b7be796c0134d59ff058dce9dec45fceadd849522356ef, sha256:07327848d6f8c081cf17050e2ac224b8de88c5e51da24dc31e9607dc58333e67, sha256:14da7baadfe540c32f08d923dc774d52da3681158e3ff51707525b1f2c6a4ccf, sha256:1aebb28c001c387021181022bbf7ea88eb1192e6431f15e15933ac7806a35576, sha256:1c58f7f6a758bb2541d1fc8e65d84f3a40d766a9617f6b3294de8aebd973f5e4, sha256:1e9c81d53254f7df5a4284e08f4df1e0fdb51e0970ca3ce2aef8d9cef917cc49, sha256:2319755ad4f11f315a2dd5bce48057ca1276c31b469a83e3abdeb936e691e03a, sha256:25b71998ba563fa1b22dc034608d328bf5865a7d30d2c0aeee21dd99ce7e9ff7, sha256:2b036d3ab1be43dbe10248834017c8e0a5d19a9d62d95e02c1708cc4521c1c01, sha256:40ac8adb00a81e9c894dceb80950820c927e29ee8816773ef731251ef76c9c74, sha256:40b8c68c994822006202ad9631efc5bc4f75050792a48cd97209f9e7aeab54aa, sha256:44a364094da3a9e1c23db40d7de035f984fe72f5674fe0881730c5400950e7fd, sha256:4622d9dda6748f97bb07a10b4cde8e1d8c6a699da259b1b0ecfff4ca52df16d5, sha256:46bff3d2916d9a4afe0b8dde4fde094617a17f44f2dd5038ec3016324b2ca491, sha256:47a7ac59a8c17466f0b82603b056b74c470b6e5dc599989304a441e0c2769089, sha256:4a54b4032616d3d384ef0cb2cd1787ec5ec92541c9364fd14fbbf1fc7cf2dad7, sha256:4bfcef009750ddaaa16e6e21624988d5b1e3e0e401cfcf0e28b36b9af210c32f, sha256:4d80c27e62663fb99eb6d0188556197b323233de62d636e5a5f429928e8d52f0, sha256:4dcad34f35f622107ec02f4305fe972230a618b5f4eee4a2ae9c77e113031eec, sha256:5bd6d5433da84118a426109e7cf0024bff5d8099a8642e8ca45935ead66b74a0, sha256:6260f5d1b0f63754cfde4dfc37898d78e3957d6fbdbd93efa425bbe219c78319, sha256:68a277cb64dd9b423cca3716591945dadbf4aeec794c9d7a5f78a0a6d24f9e8b, sha256:6be5c7419af6d9c0cff96e1e84b9a29a50607b2e0c225e611d90db5c5424cf7d, sha256:6d111f7efbedae3372c83e53e6406b79e950c9644766bb56a2fdae4eb8c2941b, sha256:76e18921a765df446a7700e8601a6d1fad0842438766bab06500e7b4c3814f47, sha256:7b3883585e729d0f848ba90bf8fb506d195dec1b7e92764be751494ba19e2dcb, sha256:7cc3e650e07161c362d14d8ff06f0e29aa1eee4a92bcca54ac4f531e3e81740c, sha256:7f3bc6558a855c285ac8f8d565342d0b55b56194636e0cbb84bd1e101654a550, sha256:851766fba7b3765af02db7e1ff0ddaf2ff0c7b21c59da67aff1d7d0ade52040b, sha256:855b48d566969c98c0c0038b8eeb655ed3b9d3548956925eacdc5d1b5fdcfc2d, sha256:86b15707778f72e3658a0d26561df85f59083e04303d044eee348212c95af1e8, sha256:8745150b3df439fe39632b972c7ac745346c3b6c808e348a429d2b0273d7624c, sha256:88521a8b0257ce8dbb9e3aa2c6bc3cb0ba6c032092fff3444e4e181b0b316030, sha256:898da5a70cb941bec753b1ce62138806176cd197b5575e69ea89bd793712f268, sha256:94d5b5355a00c962402fec920f20c0553a70973d6d95032957d2825e26645e2b, sha256:9871a4679115a42d7af342cf8abf14bb5b740b571ccf39cce87d4d8c94d84c9a, sha256:998dd42d562293be4c1e0384f58fb4d536fb4c88c2fa3bd4aa91a574e2bf1c15, sha256:9c967847aa75b8d66df2d2a26326ab0b6a4fac7e37b3762a3fde14b759d4d6ca, sha256:9d290ee87ed7804f690f20847ef8c6847506657bbe2155d3fb9b67164ccaa25d, sha256:a5975615f0a95d0549dab99dbd88364e2b8990a53d803159cf200f1fcdc2a9c4, sha256:a8b30f872c097dceb83c09635fc3c9f7780abdc13183cabf0ec0d59920db24a8, sha256:aacbc877faba5a364ad3798a296ee87c66dfc751865b166cd3f2ca70587b306b, sha256:ab25bc11ac3ec2ad6835a0bee9d7f5496422246c1743ae6e9abfd77a27308f00, sha256:adc59ea991645a3c9472315f90621568c14f09c3696576707ebcca6fb5e99a4d, sha256:b2250594cbac35267a2e85ed6d37faf4dbc52740582f421c1da864745ccf8c57, sha256:ba8670b045a5e9fa7ff7923f29e51dc43f7b567b83248728596c36d34a131788, sha256:bac98951e73d25ebbb469ac71e9962f21ec79b662c49bb38520f48eacc0620cf, sha256:c07e1317891ff2c40e7f4d79110a9a31e945feb3c47d7757ee4c974bd535a59f, sha256:c0b0f62c0027f5505f261208d646670fc4bf627706b89d7d0cdd0413006ac145, sha256:d192cee4c8846740391e19d4f5e50d881007e3ba30ae2b4b758d0a7956c94239, sha256:d5e330c30b2e7560912a13b9bdcbdf8bc85aae3399d562bf4a3bf280dc6a019e, sha256:d9c3d3bc9c0f1da56c254f63a2fa60df40acb8e0c9c84fa28134ffe1424db523, sha256:dae6b1a9ceeb158d69a19f5e75be91186d963f9b19430a257fc70e67c1241c4d, sha256:dd56609e783c8c0880b8ffbcc759c0f0408a44296d2befa417448a846d13dc10, sha256:e472bac29f1ff449d78648c9e36510b5c1c624c06034ee893eca401597ca4c28, sha256:ec944d843332d8d546c8645ee11b21015bfea07d150a99461b97c446ad7e56d7, sha256:ec9ede33b1eab2bae920e5495786a5bff8e0ef6d14858a42b733926f03139b09, sha256:ed6d831b03774b63a9f46b47dc7dc5a17e5b7694abbe119526aa501d393f8c8e, sha256:f0bbbeff269eb09f8e701bb575cad2eba1df6b459c01dbd25e968a69c3e196e7, sha256:f10bf4530e037e67a2cbba9ecb5339029b0d173f14f06a27c0e87adcd9ead753, sha256:f228ae794274f24f69e133cc583a05ff3b834b73d200b3f6f49140ca502fc212, sha256:f33265e90449be4776e36f7937fd009e0d2db65fa48054b8d03b6814397de83e, sha256:f95be95fda0e81986281bfdf7a598173680c693efc1d897e44d5f5b6d5ab3926, sha256:f977691ae20d6e97cb43284e700630a1b6c47a2ec5643fcac324a146e99ddc24, sha256:fa6d23a808c47c495768bf44a2d0589f6b97b574d34a11004ea28d97daa1375f
- response shapes: none

## POST /users/@me/billing/user-offer

- methods: POST
- features: channel.permission.edit, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, thread.create.basic, voice.disconnect.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:224ba2de93fabd5dd383fc762f8e714485fae9e856a9ace460f2cd6677257a36
- response shapes: sha256:3bb88ebf7c7a07d030d70b5d6416732792c9c0f8a69626b5de08a83d57ba8be2

## PUT /channels/{channel_id}/messages/{message_id}/reactions/{emoji}/@me

- catalog: PUT_CHANNELS_CHANNEL_ID_MESSAGES_MESSAGE_ID_REACTIONS_EMOJI__ME (src/api/routes/channels/#channel_id/messages/#message_id/reactions.ts)
- methods: PUT
- features: message.reaction.add
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: none

## PUT /channels/{channel_id}/messages/pins/{message_id}

- catalog: PUT_CHANNELS_CHANNEL_ID_MESSAGES_PINS_MESSAGE_ID (src/api/routes/channels/#channel_id/messages/pins/index.ts)
- methods: PUT
- features: message.pin.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: none

## PUT /channels/{channel_id}/permissions/{role_id}

- methods: PUT
- features: channel.permission.edit
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:b17879da300a73b7b8b8d392641b06afd4b263da5b90505640bf4d6a495dbd7f
- response shapes: none

## PUT /guilds/{guild_id}/members/@me

- methods: PUT
- features: bootstrap.idle.session, channel.permission.edit, experiments.visible_context, expressions.picker.basic, guild.role.edit.basic, message.delete.basic, message.edit.basic, message.pin.basic, message.reaction.add, message.reply.basic, message.send.basic, message.upload.attachment, navigation.channel_switch, navigation.guild_switch, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, search.member.basic, search.message.basic, settings.guild_notifications, thread.create.basic, voice.deafen_toggle, voice.disconnect.basic, voice.join.basic, voice.mute_toggle
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:224ba2de93fabd5dd383fc762f8e714485fae9e856a9ace460f2cd6677257a36
- response shapes: none
