# Feature: Reply to a message

Run: 2026-05-07T23-06-28Z-stable-local
Scenario: message.reply.basic
Build: stable 540600 / 98b5be2c2533f17f926b290d360986344ddddc9c
Build ID: 98b5be2c2533f17f926b290d360986344ddddc9c
Source refs: userdoccers_commit=259d8f8cf97ff357c4d1255afdf30e2e05672742, xhyrom_routes_commit=0d792408fc6f5f67140fe1b4cad48b386ae1fd44

Fixtures:

```json
{
	"channels": {
		"dm": "{channel_id}",
		"general": "{channel_id}",
		"secondary": "{channel_id}",
		"secondary_guild_general": "{channel_id}",
		"voice": "{channel_id}"
	},
	"disposable": [
		"channels.general",
		"guild",
		"messages.delete_target",
		"messages.edit_target",
		"messages.pin_target",
		"messages.react_target",
		"roles.feature_test_role"
	],
	"files": {
		"small_attachment": "{local_file_path}"
	},
	"guild": "{guild_id}",
	"guilds": {
		"secondary": "{guild_id}"
	},
	"messages": {
		"delete_target": "{message_id}",
		"edit_target": "{message_id}",
		"pin_target": "{message_id}",
		"react_target": "{message_id}",
		"read_target": "{message_id}",
		"reply_target": "{message_id}"
	},
	"roles": {
		"feature_test_role": "{role_id}"
	},
	"users": {
		"dm_peer": "{user_id}",
		"runner": "{user_id}"
	}
}
```

## Step: Open general channel (open-channel)

Actions:

- goto-channel / fixture-channel:general
- expect-ready

HTTP:

- probable: GET /channels/{channel_id}
  - status codes: 200
  - response shape: sha256:f83cdcd13e69b2ae9a17e8ecaccbd1e7474749d83a730ce05b8a7f4125a7ce10
  - response sample redacted: {"flags":0,"guild_id":"{guild_id}","icon_emoji":{"id":null,"name":"{redacted_string}"},"id":"{channel_id}","last_message_id":"{message_id}","last_pin_timestamp":"{phone}T22:48:{phone}+00:00","name":"{redacted_string}","nsfw":false,"parent_id":"{snowflake}","permission_overwrites":[],"position":0,"rate_limit_per_user":0,"theme_color":null,"topic":null,"type":0}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /channels/{channel_id}/messages
  - status codes: 200
  - response shape: sha256:08798a4964ace8c47f90170cb45bbbe9083e22b678962d17d4b752de167954b0
  - response sample redacted: [{"attachments":[],"author":"{redacted}","channel_id":"{channel_id}","components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":0,"id":"{message_id}","mention_everyone":false,"mention_roles":[],"mentions":[],"pinned":false,"timestamp":"{phone}T23:11:{phone}+00:00","tts":false,"type":0},{"attachments":[],"author":"{redacted}","channel_id":"{channel_id}","components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":0,"id":"{message_id}","mention_everyone":false,"mention_roles":[],"mentions":[],"pinned":false,"timestamp":"{phone}T23:11:{phone}+00:00","tts":false,"type":0},{"attachments":[],"author":"{redacted}","channel_id":"{channel_id}","components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":0,"i...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /guilds/{guild_id}/entitlements
  - status codes: 200
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - response sample redacted: []
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- background: GET /scheduled-maintenances/upcoming.json
  - status codes: 200
  - response shape: sha256:8b56135b00799c77d735c4fdc631449d82ad476c0e259a590568cfeacdba4eb0
  - response sample redacted: {"page":{"id":"srhpyqt94yxb","name":"{redacted_string}","time_zone":"America/Los_Angeles","updated_at":"{phone}T15:19:{phone}:00","url":"{redacted_string}"},"scheduled_maintenances":[]}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/affinities/guilds
  - status codes: 200
  - response shape: sha256:a71a454d2b1e3f4d6b5f705c81756af858d2dffd4cb36c8aaddd238f27010bf2
  - response sample redacted: {"guild_affinities":[]}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/survey
  - status codes: 429
  - response shape: sha256:03c791a2bff466a1f917bc4db83ed31cddd76160e2ce2fe94070faff2bd6e015
  - response sample redacted: {"global":false,"message":"You are being rate limited.","retry_after":82974.167}
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/unclaimed-games
  - status codes: 200
  - response shape: sha256:224ba2de93fabd5dd383fc762f8e714485fae9e856a9ace460f2cd6677257a36
  - response sample redacted: {}
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /guilds/{guild_id}/migrate-command-scope
  - status codes: 200
  - response shape: sha256:f248e244bf1528c3a9e627b6c71fd5b02fc0f9f265f60cbe5b87fba10c6b46ed
  - response sample redacted: {"integration_ids_with_app_commands":[]}
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:b2250594cbac35267a2e85ed6d37faf4dbc52740582f421c1da864745ccf8c57
  - request sample redacted: {"events":[{"properties":{"accessibility_features":128,"client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","event_sequence_number":1,"experimental_features":[],"launch_signature":"{uuid}","rendered_locale":"en-US","success":true,"uptime_app":0},"type":"libdiscore_loaded"},{"properties":{"accessibility_features":128,"client_app_state":"focused","client_heartbeat_initialization_timestamp":"{timestamp}","client_heartbeat_session_id":"{redacted}","client_heartbeat_version":27,"client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number"...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:c0b0f62c0027f5505f261208d646670fc4bf627706b89d7d0cdd0413006ac145
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"assignment_loaded_from_cache":false,"assignment_session_id":"{redacted}","assignment_source":"ready_payload","bucket":1,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGaX03EAg3LBJ4BAAAMAAAA","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number":18,"excluded":false,"exposure_type":"auto_fallback","guild_id":"{guild_id}","hash_result":5093,"holdout_name":null,"launch_signature":"{uuid}","location":"useGuildActionRows","location_stack":[],"name":"{redacted_string}","rendered_locale":"en-US","revision":2,"uptime_app":...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:ba8670b045a5e9fa7ff7923f29e51dc43f7b567b83248728596c36d34a131788
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"bypass_fatigue":false,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGaX03EAg3LBJ4BAAAVAAAA","client_viewport_height":720,"client_viewport_width":1280,"content_count":0,"event_sequence_number":27,"fatigable_content_count":0,"group_name":"{redacted_string}","guild_id":"{guild_id}","launch_signature":"{uuid}","rendered_locale":"en-US","type":"NAGBAR_NOTICE_DOWNLOAD","uptime_app":1},"type":"dismissible_content_shown"}],"token":"{redacted}"}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: PUT /guilds/{guild_id}/members/@me
  - status codes: 204
  - request shape: sha256:224ba2de93fabd5dd383fc762f8e714485fae9e856a9ace460f2cd6677257a36
  - request sample redacted: {}
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply

Gateway:

- background received: opcode 10
  - payload shape: sha256:1ea400906a171cedb7d42f268da0d397bbc43bd96fa7e5b1257462aa805cfb6b
  - payload sample redacted: {"d":{"_trace":["[\"gateway-prd-arm-us-east1-c-j329\",{\"micros\":0.0}]"],"heartbeat_interval":41250},"op":10,"s":null,"t":null}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- background received: opcode 11
  - payload shape: sha256:1af1fbd23162b5c1fb73f89e2dcc4c8b7bb1ad05d938f7ce86ff7a2500c988c6
  - payload sample redacted: {"d":null,"op":11,"s":null,"t":null}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- background sent: opcode 2
  - payload shape: sha256:843a77617e6ac40e91aba030ba78beb4bfb5fef43d2587ea2f63cde75d6a5616
  - payload sample redacted: {"d":{"capabilities":1734653,"client_state":{"guild_versions":{}},"properties":{"browser":"Chrome","browser_user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/{phone} Safari/537.36","browser_version":"{phone}","client_build_number":540600,"client_event_source":null,"client_launch_id":"{uuid}","device":"","has_client_mods":false,"is_fast_connect":true,"os":"Mac OS X","os_version":"10.15.7","referrer":"","referrer_current":"","referring_domain":"","referring_domain_current":"","release_channel":"stable","system_locale":"en-US"},"token":"{redacted}"},"op":2}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- background sent: opcode 3
  - payload shape: sha256:7e1f0d649c466fd4ef3003ed273ac3bae39357bf12737093f96fcc5242303213
  - payload sample redacted: {"d":{"activities":[],"afk":false,"since":0,"status":"online"},"op":3}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- background sent: opcode 37
  - payload shape: sha256:0963d99e3e99792aff47709a004b47d0e81905b7e8c02aae688fe7a66087b64b
  - payload sample redacted: {"d":{"subscriptions":{"{guild_id}":{"activities":true,"threads":true,"typing":true}}},"op":37}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- background sent: opcode 4
  - payload shape: sha256:63a1ca04c7a758c4a070747202db7a1409dc8e5e983bb21775fc0e457f18b853
  - payload sample redacted: {"d":{"channel_id":null,"flags":2,"guild_id":null,"self_deaf":false,"self_mute":true,"self_video":false},"op":4}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- background sent: opcode 40
  - payload shape: sha256:bcef1e425dfdf2747e80676e2d40ddc355f90353ad80640b86d7b0fa436317c8
  - payload sample redacted: {"d":{"qos":{"active":true,"reasons":["foregrounded"],"ver":27},"seq":3},"op":40}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- background sent: opcode 41
  - payload shape: sha256:9347a825b8f05e365dd2ece7cde37cfe2587aa14d2f972a58c366d740b98db6c
  - payload sample redacted: {"d":{"client_launch_id":"{uuid}","initialization_timestamp":"{timestamp}","session_id":"{redacted}"},"op":41}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- background sent: opcode 43
  - payload shape: sha256:217cd0038e08d92e1387122731cfed63f0f96d43ea2c0fdcb01a84a1d2beac96
  - payload sample redacted: {"d":{"fields":["status","voice_start_time"],"guild_id":"{guild_id}"},"op":43}
- background received: CHANNEL_INFO
  - payload shape: sha256:36862976ac03f2c49fbb9bc3c18c483008d01eb48c18e522b8755c75a047a539
  - payload sample redacted: {"d":{"channels":[{"id":"{channel_id}"},{"id":"{snowflake}"},{"id":"{channel_id}"},{"id":"{channel_id}"},{"id":"{snowflake}"},{"id":"{snowflake}"}],"guild_id":"{guild_id}"},"op":0,"s":7,"t":"CHANNEL_INFO"}
  - static candidates:
    - high / fast-connect.38fb8ec2baeaa13d.js / module QUEST_PREVIEW_TOOL_2
- probable received: READY
  - payload shape: sha256:cd2f45c474f217c58e5fe1347c4f3a94507c654c08897e19915ae0293f8c551a
  - payload sample redacted: {"d":{"_trace":["[\"gateway-prd-arm-us-east1-c-j329\",{\"micros\":333195,\"calls\":[\"id_created\",{\"micros\":1466,\"calls\":[]},\"session_lookup_time\",{\"micros\":267,\"calls\":[]},\"session_lookup_finished\",{\"micros\":19,\"calls\":[]},\"sessions-prd-gcp-us-east1-c-106\",{\"micros\":330830,\"calls\":[\"start_session\",{\"micros\":291130,\"calls\":[\"prd-rpc-547f9f7987-psqpw\",{\"micros\":173089,\"calls\":[\"get_user\",{\"micros\":29510},\"get_guilds\",{\"micros\":28766},\"user_settings_proto\",{\"micros\":1420},\"relationships\",{\"micros\":4607},\"game_relationships\",{\"micros\":4},\"friend_suggestion\",{\"micros\":45},\"connections\",{\"micros\":11},\"serialized_read_states\",{\"micros\":4},\"send_scheduled_deletion_message\",{\"micros\":2},\"sanitize_premium_perks\",{\"micros\"...
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- background received: READY_SUPPLEMENTAL
  - payload shape: sha256:20f7f12876215f9cb7b67726824e3e32e11f0c0b7cd8aab1ce6a44281dddd82b
  - payload sample redacted: {"d":{"disclose":["pomelo"],"game_invites":[],"guilds":[{"activity_instances":[],"embedded_activities":[],"id":"{guild_id}","voice_states":[]},{"activity_instances":[],"embedded_activities":[],"id":"{guild_id}","voice_states":[]}],"lazy_private_channels":[],"merged_members":[[],[]],"merged_presences":{"friends":[{"activities":[{"content_classification":{"data":null,"loaded":true},"created_at":"{timestamp}","id":"custom","name":"{redacted_string}","state":"samuelscheit.com","type":4}],"client_status":{"web":"idle"},"hidden_activities":[],"processed_at_timestamp":"{timestamp}","restricted_application":null,"status":"idle","user_id":"{snowflake}"}],"guilds":[[],[]]},"user_activities":[]},"op":0,"s":2,"t":"READY_SUPPLEMENTAL"}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable received: SESSIONS_REPLACE
  - payload shape: sha256:2fc1d0710087be43b84eff23481731955591ddbded58ddaf115b9c8238bed5fd
  - payload sample redacted: {"d":[{"activities":[],"client_info":{"client":"web","os":"osx","version":0},"hidden_activities":[],"processed_at_timestamp":"{timestamp}","session_id":"{redacted}","status":"online"}],"op":0,"s":5,"t":"SESSIONS_REPLACE"}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- background received: THREAD_LIST_SYNC
  - payload shape: sha256:6e72127f8d471daea0bff4af8a53132a2b4f70cc6dee946489c60ce6f60dc53e
  - payload sample redacted: {"d":{"guild_id":"{guild_id}","most_recent_messages":[{"attachments":[],"author":"{redacted}","channel_id":"{snowflake}","channel_type":11,"components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":0,"id":"{snowflake}","is_thread_dispatch":true,"mention_everyone":false,"mention_roles":[],"mentions":[],"nonce":"{snowflake}","pinned":false,"position":0,"timestamp":"{phone}T22:48:{phone}+00:00","tts":false,"type":0}],"threads":[{"flags":0,"guild_id":"{guild_id}","id":"{snowflake}","last_message_id":"{snowflake}","member_count":1,"member_ids_preview":["{user_id}"],"message_count":1,"name":"{redacted_string}","owner_id":"{user_id}","parent_id":"{channel_id}","rate_limit_per_user":0,"thread_metadata":{"archive_timestamp":"{phone}T22:48:{phone}+00:00","archived":...
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events

## Step: Send reply (send-reply)

Actions:

- click / text / value redacted
- fill / role:textbox / value redacted
- press / keyboard / Enter
- expect-network / POST /channels/{channel_id}/messages
- expect-gateway / MESSAGE_CREATE / received

HTTP:

- probable: GET /channels/{channel_id}/messages
  - status codes: 200
  - response shape: sha256:f4ac9fdc34e0cf59afd716fb7fb180bdc3ab29d937b976f1a07a62364ee71a13
  - response sample redacted: [{"attachments":[],"author":"{redacted}","channel_id":"{channel_id}","components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":0,"id":"{snowflake}","mention_everyone":false,"mention_roles":[],"mentions":[],"message_reference":{"channel_id":"{snowflake}","guild_id":"{guild_id}","type":0},"pinned":false,"timestamp":"{phone}T22:48:{phone}+00:00","tts":false,"type":18},{"attachments":[],"author":"{redacted}","channel_id":"{channel_id}","components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":0,"id":"{snowflake}","mention_everyone":false,"mention_roles":[],"mentions":[],"pinned":false,"timestamp":"{phone}T22:46:{phone}+00:00","tts":false,"type":7},{"attachments":[],"author":"{redacted}","channel_id":"{channel_id}","components":...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /content-inventory/users/@me
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /games/detectable/exclusions
  - status codes: 200
  - response shape: sha256:038f30c12c43492c20a3f1758a65e95ca82971fc46f99725af85b2176cdf8610
  - response sample redacted: {"executables":["brocrashreporter.exe","config.exe","crashreportclient.exe","crosshairx.exe","dxsetup.exe","eaanticheat.gameservicelauncher.exe","eaanticheat.installer.exe","easyanticheat_setup.exe","gamerangeroemsetup.exe","install.exe","launcher.exe","launcherpatcher.exe","modlauncher.exe","pbsetup.exe","proxyinstallshield.exe","radiant_modtools.exe","rockstar-games-launcher.exe","sharex.exe","start_protected_game.exe","ue4prereqsetup_x64.exe","ueprereqsetup_x64.exe","ui32.exe","unitycrashhandler64.exe","vrmonitor.exe","wallpaper64.exe"],"patterns":["vcredist.*\\.exe$"]}
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /guilds/{guild_id}/integrations
  - status codes: 200
  - response shape: sha256:068dd3c92aadb60e2d78392ace887e0ca551334dcc5d20cee51cb24fbf7f17f6
  - response sample redacted: [{"account":{"id":"{user_id}","name":"{redacted_string}"},"application":{"bot":{"accent_color":null,"avatar":null,"avatar_decoration_data":null,"banner":null,"banner_color":null,"bot":true,"clan":null,"collectibles":null,"discriminator":"0807","display_name_styles":null,"flags":0,"global_name":null,"id":"{user_id}","primary_guild":null,"public_flags":0,"username":"{redacted_string}"},"description":"{redacted_string}","icon":null,"id":"{user_id}","is_discoverable":false,"is_monetized":false,"is_verified":false,"name":"{redacted_string}","role_connections_verification_url":null,"summary":"","type":null},"enabled":true,"id":"{snowflake}","name":"{redacted_string}","scopes":["applications.commands","bot"],"type":"discord","user":{"accent_color":null,"avatar":null,"avatar_decoration_data":nu...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /guilds/{guild_id}/powerups
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /partner-sdk/storefront-config
  - status codes: 200
  - response shape: sha256:b07133b0287c9006dfebd738f0ded9ed1cf90d5c1aa26f7dba1a89612700725f
  - response sample redacted: {"announcement_modal_config":{"application_id":"{snowflake}","version":3},"promotion_end_datetime":"{phone}T18:00:00+00:00","promotional_sku_ids":["{snowflake}","{snowflake}","{snowflake}","{snowflake}"],"storefronts":[{"application_id":"{snowflake}","collectibles_shop_navigation_enabled":true,"excluded_platforms":["playstation"],"game_id":"{snowflake}","guild_id":"{snowflake}"},{"application_id":"{snowflake}","collectibles_shop_navigation_enabled":true,"excluded_platforms":["playstation","xbox"],"game_id":"{snowflake}","guild_id":"{snowflake}"}]}
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /partner-sdk/storefront-eligibility
  - status codes: 200
  - response shape: sha256:e171040d61ac67f1b8609e1f5a48a208953ecfa6ccb910381017d33b951dec5d
  - response sample redacted: {"{snowflake}":{"is_eligible":false},"{snowflake}#2":{"is_eligible":false}}
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /promotions
  - status codes: 200
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - response sample redacted: []
  - static candidates:
    - high / fast-connect.38fb8ec2baeaa13d.js / module BILLING_PROMOTION_REDEMPTION
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /quests/@me
  - status codes: 200
  - response shape: sha256:6042b3e0f12d958257cc2f5e0e0014ec090041c45ac07a1ccef0cff8c0c5f3c8
  - response sample redacted: {"excluded_quests":[{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}","replacement_id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{snowflake}"},{"id":"{sno...
  - static candidates:
    - medium / fast-connect.38fb8ec2baeaa13d.js / module QUEST_PREVIEW_TOOL_2
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /quests/decision
  - status codes: 200
  - response shape: sha256:de2cf1cd8dd0ac33cfd9471da28b457bfd51bd689a6f1016b1d87d097a1e0f0e
  - response sample redacted: {"ad_context":null,"ad_identifiers":null,"creative":null,"metadata_sealed":"eyJrZXlfZmluZ2VycHJpbnQiOiI4ZGUwNzVmMiIsInBheWxvYWQiOiJBWHdMd2dJQ0cyWE9PVTAyamJRQXZmZklMMmxhRE40OU9WaTdhdE0vbWdLYkpoYWtOc1EvT3RCcUl4eS9jVE4zZ2RhRVJCVTN4QlFDUlhtUmdITS9HVWlWcU1panVXQWREVVMyOStCYkpJN3dmWjB5QjJIOFAzWmRGV0h1aTcrZUpESkU2THpWS2grUjUwRmdqZ2xDVU9Sb05qaTM5SEc2UEtvQ3VDbFBIUTIyWG03bFhMV0ZXbDEyRXZib0NQTW9vWXBnK2VpTGtmMFVGNTFMNmswSTJqSmtpUFJnTXUzRVJ2eHhTR3RybEZkZ3U5cWphL3lWT3I2SHdSeGM1VTdJenFvNFRFVXpYRFM0dWpxSUxJYS9MenlkNUVhZC93MUMza2VXcHc2OUFyaXZNSW13QjkxekJMMEtvc1U0LzdRcHNhMDNsRGVZd3lHM29DSmxmbHIvZmtCd1Z5bjFyRitCd3FDaXYzR2dUL0pYTWVmdXUyUTJUM0VINXZWRktZNHk4S2J1NG9ZdVRsbXExRmUycGc0d1ZhVkZuWU5qbmVIeWxNY1Y0ejh2ZEV1YTIzUFN1MGlFNlJuSW0yS2lkNEVSN0hxNDY4TWhQUnhMc29XMFhaZWkvYlNLT3ZEUWhzTFlwVXdHZ3RjVXAyRjJkS1R0YTZTS...
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /store/published-listings/skus
  - status codes: 200
  - response shape: sha256:9861bba2dd083f02fc7bcdcadc2c08e99709f9ffab1c7cbcd1f572d2571ab82b
  - response sample redacted: [{"benefits":[],"description":"{redacted_string}","id":"{snowflake}","powerup_metadata":{"animated_image_url":"{redacted_string}","category_type":"perk","deactivation_cooldown_period_days":null,"static_image_url":"{redacted_string}","store_removal_date":null},"published":true,"sku":{"access_type":1,"application_id":"{snowflake}","created_at":"{phone}T20:53:{phone}+00:00","dependent_sku_id":"{snowflake}","features":[],"flags":0,"id":"{snowflake}","manifest_labels":null,"name":"{redacted_string}","powerup_metadata":{"animated_image_url":"{redacted_string}","boost_price":5,"category_type":"perk","guild_features":{"additional_emoji_slots":0,"additional_sound_slots":0,"additional_sticker_slots":0,"features":["GUILD_TAGS_BADGE_PACK_FLEX"]},"purchase_limit":1,"static_image_url":"{redacted_stri...
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/applications/{application_id}/entitlements
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/billing/checkout-recovery
  - status codes: 200
  - response shape: sha256:343e5e3408bea653f4a7124bb7e27ae0fa3b7a55a3ac6a12a575b23028888b41
  - response sample redacted: {"is_eligible":false}
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/billing/payment-sources
  - status codes: 200
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - response sample redacted: []
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/billing/payment-sources
  - status codes: 200
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - response sample redacted: []
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/billing/subscriptions
  - status codes: 200
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - response sample redacted: []
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/billing/subscriptions
  - status codes: 200
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - response sample redacted: []
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/collectibles-marketing
  - status codes: 200
  - response shape: sha256:9713ac6dba59eed9eeae7beffb5c51d37553ac247d8af1aa05fc165825498086
  - response sample redacted: {"marketings":{"0":{"asset":"https://cdn.discordapp.com/media/v1/collectibles-shop/584e47dbf5584e1cd297c010c4d75793f9a6c33f1b5bb8ec719c1965aea1e869","body":"Fruity friends and kawaii cats are waiting to be picked in the Shop.","dismissible_content":422,"ref_target_background":null,"title":"Got a Sweet Tooth?","type":4,"version":71},"2":{"asset":"https://cdn.discordapp.com/media/v1/collectibles-shop/c7e0b8b2830f23ed4f8dd{phone}b3f7d13e1c5b683940c10b11644c39dd","body":"Check out the latest avatar decorations, profile effects, and nameplates and collect your favorite styles.","popout_asset":"https://cdn.discordapp.com/media/v1/collectibles-shop/c420476d0acc4fedbc33cd891bdff8ff8efc80ef667f2f3a688b922aa0f19904","revert_text_color":true,"title":"Give your profile a fresh look","type":2,"versi...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/mfa/webauthn/credentials
  - status codes: 200
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - response sample redacted: []
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/settings-proto/2
  - status codes: 200
  - response shape: sha256:3bc6a58318372b5fb79303310048eb484a1ec86d8517c99814581d1076fc42a9
  - response sample redacted: {"settings":"CgIYAjIjCiEKCHRodW1ic3VwEhUIARIG/ueDpeAzGP///////////wFibAogCf0QgJZ+ddgUEhUIARIGkNWCpeAzGP///////////wEKJgk4AEQMuFq0ERIbCAISDKya/KTgM9HhgqXgMxj///////////8BCiAJNQBEDLhatBESFQgBEgasmvyk4DMY////////////AWojCiEKCHRodW1ic3VwEhUIARIG/ueDpeAzGP///////////wE="}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- direct: POST /channels/{channel_id}/messages
  - status codes: 200
  - request shape: sha256:82011c80e8e943e58547779a442f0d07e69c103c20a46586be727175aa1d604a
  - request sample redacted: {"content":"{redacted_string}","flags":0,"mobile_network_type":"unknown","nonce":"{snowflake}","tts":false}
  - response shape: sha256:a6c15cd7b5edb5f961664e1e274d78124188b9a8519e8319404c31eb807522da
  - response sample redacted: {"attachments":[],"author":"{redacted}","channel_id":"{channel_id}","components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":0,"id":"{snowflake}","mention_everyone":false,"mention_roles":[],"mentions":[],"nonce":"{snowflake}","pinned":false,"timestamp":"{phone}T23:34:{phone}+00:00","tts":false,"type":0}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:47a7ac59a8c17466f0b82603b056b74c470b6e5dc599989304a441e0c2769089
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGaX03EAg3LBJ4BAAAWAAAA","client_viewport_height":720,"client_viewport_width":1280,"error_message":"You are being rate limited.","event_sequence_number":28,"launch_signature":"{uuid}","rendered_locale":"en-US","request_method":"get","status_code":429,"uptime_app":2,"url":"{redacted_string}"},"type":"network_action_user_survey_fetch"}],"token":"{redacted}"}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:44a364094da3a9e1c23db40d7de035f984fe72f5674fe0881730c5400950e7fd
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"bypass_fatigue":true,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGaX03EAg3LBJ4BAAAXAAAA","client_viewport_height":720,"client_viewport_width":1280,"content_count":1,"event_sequence_number":29,"fatigable_content_count":1,"guild_id":"{guild_id}","launch_signature":"{uuid}","rendered_locale":"en-US","type":"FIRST_BOOSTER_UPSELL_OVERSEER","uptime_app":2},"type":"dismissible_content_shown"},{"properties":{"accessibility_features":524416,"app_hardware_acceleration_enabled":true,"client_app_state":"focused","client_heartbeat_session_id":"{redact...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:1aebb28c001c387021181022bbf7ea88eb1192e6431f15e15933ac7806a35576
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"assignment_loaded_from_cache":false,"assignment_session_id":"{redacted}","assignment_source":"ready_payload","bucket":1,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGaX03EAg3LBJ4BAAAZAAAA","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number":31,"excluded":false,"exposure_type":"manual","guild_id":"{guild_id}","hash_result":5093,"holdout_name":null,"launch_signature":"{uuid}","location":"GuildPowerupsManager","location_stack":[],"name":"{redacted_string}","rendered_locale":"en-US","revision":2,"uptime_app":3},"t...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:4a54b4032616d3d384ef0cb2cd1787ec5ec92541c9364fd14fbbf1fc7cf2dad7
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGaX03EAg3LBJ4BAAAgAAAA","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number":38,"launch_signature":"{uuid}","received_etag":"W/\"1350c14f145ba6c803c20a042c395cd1\"","rendered_locale":"en-US","request_method":"get","sent_etag":"","status_code":200,"uptime_app":3,"url":"{redacted_string}"},"type":"network_action_detectable_non_games_fetch"}],"token":"{redacted}"}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - request shape: sha256:f10bf4530e037e67a2cbba9ecb5339029b0d173f14f06a27c0e87adcd9ead753
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGaX03EAg3LBJ4BAAAhAAAA","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number":39,"launch_signature":"{uuid}","received_etag":"W/\"4f1170c3d8681b0b3bbe2c119bba8135\"","rendered_locale":"en-US","request_method":"get","sent_etag":"","status_code":200,"uptime_app":4,"url":"{redacted_string}"},"type":"network_action_detectable_applications_fetch"},{"properties":{"accessibility_features":524416,"assignment_loaded_from_cache":false,"assignment_session_id":"{redacted}","assign...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /users/@me/billing/user-offer
  - status codes: 404
  - request shape: sha256:224ba2de93fabd5dd383fc762f8e714485fae9e856a9ace460f2cd6677257a36
  - request sample redacted: {}
  - response shape: sha256:3bb88ebf7c7a07d030d70b5d6416732792c9c0f8a69626b5de08a83d57ba8be2
  - response sample redacted: {"code":0,"message":"404: Not Found"}
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply

Gateway:

- probable sent: opcode 8
  - payload shape: sha256:ca306c45a770a8d17dca287f7e44694f510f4780141ec13545c57d3ab3bf55f2
  - payload sample redacted: {"d":{"guild_id":["{guild_id}"],"presences":false,"user_ids":["{user_id}"]},"op":8}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable received: GUILD_MEMBERS_CHUNK
  - payload shape: sha256:7c1d40bb32d5b4efeb01ef169f1670126cd390d4a51e77ccee19f7054df6281b
  - payload sample redacted: {"d":{"chunk_count":1,"chunk_index":0,"guild_id":"{guild_id}","members":[{"avatar":null,"banner":null,"communication_disabled_until":null,"deaf":false,"flags":0,"joined_at":"{phone}T22:46:{phone}+00:00","mute":false,"nick":null,"pending":false,"premium_since":null,"roles":["{snowflake}"],"user":{"avatar":null,"avatar_decoration_data":null,"bot":true,"collectibles":null,"discriminator":"0807","display_name":null,"display_name_styles":null,"global_name":null,"id":"{user_id}","primary_guild":null,"public_flags":0,"username":"{redacted_string}"}}],"not_found":[]},"op":0,"s":8,"t":"GUILD_MEMBERS_CHUNK"}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- direct received: MESSAGE_CREATE
  - payload shape: sha256:d24cd55eb17c03e4fb3f32ef3f65c2b08afd4428112301dcdff0f87ab0f5baed
  - payload sample redacted: {"d":{"attachments":[],"author":"{redacted}","channel_id":"{channel_id}","channel_type":0,"components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":0,"guild_id":"{guild_id}","id":"{snowflake}","member":{"avatar":null,"banner":null,"communication_disabled_until":null,"deaf":false,"flags":0,"joined_at":"{phone}T09:12:{phone}+00:00","mute":false,"nick":null,"pending":false,"premium_since":null,"roles":[]},"mention_everyone":false,"mention_roles":[],"mentions":[],"nonce":"{snowflake}","pinned":false,"timestamp":"{phone}T23:34:{phone}+00:00","tts":false,"type":0},"op":0,"s":9,"t":"MESSAGE_CREATE"}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events

Review:

- unknown events: 0
- background events: 28
