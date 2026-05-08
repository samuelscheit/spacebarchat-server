# Feature: Search guild messages

Run: 2026-05-07T23-06-28Z-stable-local
Scenario: search.message.basic
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
  - response sample redacted: {"global":false,"message":"You are being rate limited.","retry_after":83287.454}
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
  - request shape: sha256:1e9c81d53254f7df5a4284e08f4df1e0fdb51e0970ca3ce2aef8d9cef917cc49
  - request sample redacted: {"events":[{"properties":{"accessibility_features":128,"client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","event_sequence_number":1,"experimental_features":[],"launch_signature":"{uuid}","rendered_locale":"en-US","success":true,"uptime_app":0},"type":"libdiscore_loaded"},{"properties":{"accessibility_features":128,"client_app_state":"focused","client_heartbeat_initialization_timestamp":"{timestamp}","client_heartbeat_session_id":"{redacted}","client_heartbeat_version":27,"client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number"...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:f977691ae20d6e97cb43284e700630a1b6c47a2ec5643fcac324a146e99ddc24
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBFshPiu+EXGBJ4BAAAVAAAA","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number":25,"launch_signature":"{uuid}","load_id":"{uuid}","ready_packing_algorithm":"json","ready_unpack_duration_ms":1,"rendered_locale":"en-US","time_first_render_after_ready_end":3400,"uptime_app":2,"url_root_path":"{redacted_string}","was_authenticated":"{redacted}"},"type":"app_web_perf_startup_metrics"}],"token":"{redacted}"}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:6d111f7efbedae3372c83e53e6406b79e950c9644766bb56a2fdae4eb8c2941b
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBFshPiu+EXGBJ4BAAAWAAAA","client_viewport_height":720,"client_viewport_width":1280,"evaluation_id":"61f72003","event_sequence_number":26,"experiment":"2025-11-overlay-chat","exposure_location":"OverlayTextChatAutomaticLifecycleManager","launch_signature":"{uuid}","rendered_locale":"en-US","tracked_variation_id":0,"unit_type":"user","uptime_app":2},"type":"experiment_user_evaluation_exposed"}],"token":"{redacted}"}
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
  - payload sample redacted: {"d":{"_trace":["[\"gateway-prd-arm-us-east1-d-kq8s\",{\"micros\":0.0}]"],"heartbeat_interval":41250},"op":10,"s":null,"t":null}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- background sent: opcode 2
  - payload shape: sha256:843a77617e6ac40e91aba030ba78beb4bfb5fef43d2587ea2f63cde75d6a5616
  - payload sample redacted: {"d":{"capabilities":1734653,"client_state":{"guild_versions":{}},"properties":{"browser":"Chrome","browser_user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/{phone} Safari/537.36","browser_version":"{phone}","client_build_number":540600,"client_event_source":null,"client_launch_id":"{uuid}","device":"","has_client_mods":false,"is_fast_connect":true,"os":"Mac OS X","os_version":"10.15.7","referrer":"","referrer_current":"","referring_domain":"","referring_domain_current":"","release_channel":"stable","system_locale":"en-US"},"token":"{redacted}"},"op":2}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable sent: opcode 37
  - payload shape: sha256:3018d6a71b85de7f979e8205fccabbbc5c2e07858991470f1eba02cd7aa83578
  - payload sample redacted: {"d":{"subscriptions":{"{guild_id}":{"activities":true,"channels":{},"member_updates":false,"members":[],"thread_member_lists":[],"threads":true,"typing":true}}},"op":37}
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
  - payload sample redacted: {"d":{"qos":{"active":true,"reasons":["foregrounded"],"ver":27},"seq":1},"op":40}
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
- probable received: READY
  - payload shape: sha256:cd2f45c474f217c58e5fe1347c4f3a94507c654c08897e19915ae0293f8c551a
  - payload sample redacted: {"d":{"_trace":["[\"gateway-prd-arm-us-east1-d-kq8s\",{\"micros\":2803131,\"calls\":[\"id_created\",{\"micros\":1101,\"calls\":[]},\"session_lookup_time\",{\"micros\":307,\"calls\":[]},\"session_lookup_finished\",{\"micros\":18,\"calls\":[]},\"sessions-prd-gcp-us-east1-d-149\",{\"micros\":2801034,\"calls\":[\"start_session\",{\"micros\":2758786,\"calls\":[\"prd-rpc-547f9f7987-dx9xp\",{\"micros\":2333769,\"calls\":[\"get_user\",{\"micros\":135302},\"get_guilds\",{\"micros\":55669},\"user_settings_proto\",{\"micros\":51},\"relationships\",{\"micros\":14718},\"game_relationships\",{\"micros\":5},\"friend_suggestion\",{\"micros\":40},\"connections\",{\"micros\":49},\"serialized_read_states\",{\"micros\":22},\"send_scheduled_deletion_message\",{\"micros\":5},\"sanitize_premium_perks\",{\"mic...
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
  - payload shape: sha256:e705006a2f5b68e160c64ca431f6b31a67cd3316ba437a7545e7acf69dcfd43c
  - payload sample redacted: {"d":[{"activities":[],"client_info":{"client":"web","os":"osx","version":0},"hidden_activities":[],"processed_at_timestamp":0,"session_id":"{redacted}","status":"online"}],"op":0,"s":3,"t":"SESSIONS_REPLACE"}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- background received: THREAD_LIST_SYNC
  - payload shape: sha256:6e72127f8d471daea0bff4af8a53132a2b4f70cc6dee946489c60ce6f60dc53e
  - payload sample redacted: {"d":{"guild_id":"{guild_id}","most_recent_messages":[{"attachments":[],"author":"{redacted}","channel_id":"{snowflake}","channel_type":11,"components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":0,"id":"{snowflake}","is_thread_dispatch":true,"mention_everyone":false,"mention_roles":[],"mentions":[],"nonce":"{snowflake}","pinned":false,"position":0,"timestamp":"{phone}T22:48:{phone}+00:00","tts":false,"type":0}],"threads":[{"flags":0,"guild_id":"{guild_id}","id":"{snowflake}","last_message_id":"{snowflake}","member_count":1,"member_ids_preview":["{user_id}"],"message_count":1,"name":"{redacted_string}","owner_id":"{user_id}","parent_id":"{channel_id}","rate_limit_per_user":0,"thread_metadata":{"archive_timestamp":"{phone}T22:48:{phone}+00:00","archived":...
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events

## Step: Search messages (search-messages)

Actions:

- fill / role:combobox / options:name / value redacted
- press / keyboard / Enter
- expect-network / GET /guilds/{guild_id}/messages/search

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
- probable: GET /guilds/{guild_id}/integrations
  - status codes: 200
  - response shape: sha256:068dd3c92aadb60e2d78392ace887e0ca551334dcc5d20cee51cb24fbf7f17f6
  - response sample redacted: [{"account":{"id":"{user_id}","name":"{redacted_string}"},"application":{"bot":{"accent_color":null,"avatar":null,"avatar_decoration_data":null,"banner":null,"banner_color":null,"bot":true,"clan":null,"collectibles":null,"discriminator":"0807","display_name_styles":null,"flags":0,"global_name":null,"id":"{user_id}","primary_guild":null,"public_flags":0,"username":"{redacted_string}"},"description":"{redacted_string}","icon":null,"id":"{user_id}","is_discoverable":false,"is_monetized":false,"is_verified":false,"name":"{redacted_string}","role_connections_verification_url":null,"summary":"","type":null},"enabled":true,"id":"{snowflake}","name":"{redacted_string}","scopes":["applications.commands","bot"],"type":"discord","user":{"accent_color":null,"avatar":null,"avatar_decoration_data":nu...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- direct: GET /guilds/{guild_id}/messages/search
  - status codes: 200
  - response shape: sha256:f3cec789221403a14c8ae4c57c1bf9e3457f5cfe073d05fe8d8dd3688e2bff93
  - response sample redacted: {"analytics_id":"92a69047bf397902ebddec861765efab","doing_deep_historical_index":false,"messages":[[{"attachments":[],"author":"{redacted}","channel_id":"{channel_id}","components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":0,"hit":true,"id":"{message_id}","mention_everyone":false,"mention_roles":[],"mentions":[],"pinned":false,"timestamp":"{phone}T23:07:{phone}+00:00","tts":false,"type":0}]],"total_results":1}
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
- probable: POST /science
  - status codes: 204
  - request shape: sha256:ba8670b045a5e9fa7ff7923f29e51dc43f7b567b83248728596c36d34a131788
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"bypass_fatigue":false,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBFshPiu+EXGBJ4BAAAXAAAA","client_viewport_height":720,"client_viewport_width":1280,"content_count":0,"event_sequence_number":27,"fatigable_content_count":0,"group_name":"{redacted_string}","guild_id":"{guild_id}","launch_signature":"{uuid}","rendered_locale":"en-US","type":"NAGBAR_NOTICE_DOWNLOAD","uptime_app":2},"type":"dismissible_content_shown"}],"token":"{redacted}"}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:47a7ac59a8c17466f0b82603b056b74c470b6e5dc599989304a441e0c2769089
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBFshPiu+EXGBJ4BAAAYAAAA","client_viewport_height":720,"client_viewport_width":1280,"error_message":"You are being rate limited.","event_sequence_number":28,"launch_signature":"{uuid}","rendered_locale":"en-US","request_method":"get","status_code":429,"uptime_app":2,"url":"{redacted_string}"},"type":"network_action_user_survey_fetch"}],"token":"{redacted}"}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:44a364094da3a9e1c23db40d7de035f984fe72f5674fe0881730c5400950e7fd
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"bypass_fatigue":true,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBFshPiu+EXGBJ4BAAAZAAAA","client_viewport_height":720,"client_viewport_width":1280,"content_count":1,"event_sequence_number":29,"fatigable_content_count":1,"guild_id":"{guild_id}","launch_signature":"{uuid}","rendered_locale":"en-US","type":"FIRST_BOOSTER_UPSELL_OVERSEER","uptime_app":2},"type":"dismissible_content_shown"},{"properties":{"accessibility_features":524416,"app_hardware_acceleration_enabled":true,"client_app_state":"focused","client_heartbeat_session_id":"{redact...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:40ac8adb00a81e9c894dceb80950820c927e29ee8816773ef731251ef76c9c74
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"channel_hidden":false,"channel_id":"{channel_id}","channel_member_perms":"{snowflake}","channel_size_total":0,"channel_type":0,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBFshPiu+EXGBJ4BAAAbAAAA","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number":31,"guild_id":"{guild_id}","guild_is_vip":false,"guild_member_num_roles":0,"guild_member_perms":"{snowflake}","guild_num_channels":4,"guild_num_roles":3,"guild_num_text_channels":3,"guild_num_voice_channels":1,"guild_size_total":2,"is_member":true,"launch_signature":...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - request shape: sha256:4dcad34f35f622107ec02f4305fe972230a618b5f4eee4a2ae9c77e113031eec
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"channel_hidden":false,"channel_id":"{channel_id}","channel_member_perms":"{snowflake}","channel_size_total":0,"channel_type":0,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBFshPiu+EXGBJ4BAAAeAAAA","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number":34,"guild_id":"{guild_id}","guild_is_vip":false,"guild_member_num_roles":0,"guild_member_perms":"{snowflake}","guild_num_channels":4,"guild_num_roles":3,"guild_num_text_channels":3,"guild_num_voice_channels":1,"guild_size_total":2,"is_error":false,"is_indexing":false...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply

Gateway:

- background received: opcode 11
  - payload shape: sha256:1af1fbd23162b5c1fb73f89e2dcc4c8b7bb1ad05d938f7ce86ff7a2500c988c6
  - payload sample redacted: {"d":null,"op":11,"s":null,"t":null}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable sent: opcode 8
  - payload shape: sha256:a10adee2b7019715c25a9493bc284ce0f84b26f3a2bb1ec6c00e095e149da252
  - payload sample redacted: {"d":{"guild_id":["{guild_id}"],"limit":10,"presences":true,"query":"dm-test-{phone}t23-06-28z-stable-local"},"op":8}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- background received: CHANNEL_INFO
  - payload shape: sha256:36862976ac03f2c49fbb9bc3c18c483008d01eb48c18e522b8755c75a047a539
  - payload sample redacted: {"d":{"channels":[{"id":"{channel_id}"},{"id":"{snowflake}"},{"id":"{channel_id}"},{"id":"{channel_id}"},{"id":"{snowflake}"},{"id":"{snowflake}"}],"guild_id":"{guild_id}"},"op":0,"s":5,"t":"CHANNEL_INFO"}
  - static candidates:
    - high / fast-connect.38fb8ec2baeaa13d.js / module QUEST_PREVIEW_TOOL_2
- probable received: GUILD_MEMBERS_CHUNK
  - payload shape: sha256:74c760541ae6bd1e2054224b149a33279d98ffcb08c0bc8bfc31f4d8bc645744
  - payload sample redacted: {"d":{"chunk_count":1,"chunk_index":0,"guild_id":"{guild_id}","members":[],"presences":[]},"op":0,"s":7,"t":"GUILD_MEMBERS_CHUNK"}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events

Review:

- unknown events: 0
- background events: 19
