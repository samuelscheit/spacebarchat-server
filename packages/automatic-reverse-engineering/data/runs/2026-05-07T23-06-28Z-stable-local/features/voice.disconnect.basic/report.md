# Feature: Disconnect from a voice channel

Run: 2026-05-07T23-06-28Z-stable-local
Scenario: voice.disconnect.basic
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

## Step: Join voice channel (join-voice)

Actions:

- goto-channel / fixture-channel:voice
- click / role:button / options:name
- expect-gateway / opcode 4 / sent
- expect-gateway / VOICE_STATE_UPDATE / received

HTTP:

- probable: GET /activities/shelf
  - status codes: 200
  - response shape: sha256:cb707e915895757ab5f04e6bcded17afdfce1c9e1818ca96a7d99132dcad8c18
  - response sample redacted: {"activities":[{"activity_preview_video_asset_id":"{snowflake}","application_id":"{snowflake}","blocked_locales":[],"client_platform_config":{"android":{"label_from":null,"label_type":0,"label_until":null,"omit_badge_from_surfaces":[],"release_phase":"in_development"},"ios":{"label_from":null,"label_type":0,"label_until":null,"omit_badge_from_surfaces":[],"release_phase":"in_development"},"web":{"label_from":null,"label_type":0,"label_until":null,"omit_badge_from_surfaces":[],"release_phase":"global_launch"}},"default_orientation_lock_state":1,"displays_advertisements":false,"free_period_ends_at":null,"free_period_starts_at":null,"has_csp_exception":true,"has_proxy_request_signing":false,"legacy_responsive_aspect_ratio":false,"premium_tier_requirement":null,"requires_age_gate":false,"sh...
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
    - medium / 36704.c6207173d570a24f.js
- probable: GET /channels/{channel_id}
  - status codes: 200
  - response shape: sha256:155f2dd543f873af7c469929a730ccea5b38c3546ee223c6192c4a7baa78025c
  - response sample redacted: {"bitrate":64000,"flags":0,"guild_id":"{guild_id}","icon_emoji":{"id":null,"name":"{redacted_string}"},"id":"{channel_id}","last_message_id":null,"name":"{redacted_string}","nsfw":false,"parent_id":"{snowflake}","permission_overwrites":[],"position":0,"rate_limit_per_user":0,"rtc_region":null,"theme_color":null,"type":2,"user_limit":0,"voice_background_display":null,"voice_hangout":null}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /channels/{channel_id}/messages
  - status codes: 200
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - response sample redacted: []
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /channels/{channel_id}/voice-history
  - status codes: 429
  - response shape: sha256:03c791a2bff466a1f917bc4db83ed31cddd76160e2ce2fe94070faff2bd6e015
  - response sample redacted: {"global":false,"message":"You are being rate limited.","retry_after":414.312}
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /guilds/{guild_id}/entitlements
  - status codes: 200
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - response sample redacted: []
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /scheduled-maintenances/upcoming.json
  - status codes: 200
  - response shape: sha256:8b56135b00799c77d735c4fdc631449d82ad476c0e259a590568cfeacdba4eb0
  - response sample redacted: {"page":{"id":"srhpyqt94yxb","name":"{redacted_string}","time_zone":"America/Los_Angeles","updated_at":"{phone}T17:09:{phone}:00","url":"{redacted_string}"},"scheduled_maintenances":[]}
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
  - response sample redacted: {"global":false,"message":"You are being rate limited.","retry_after":79737.035}
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
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"assignment_loaded_from_cache":false,"assignment_session_id":"{redacted}","assignment_source":"ready_payload","bucket":1,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGDQa+xWnf8BJ4BAAAMAAAA","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number":18,"excluded":false,"exposure_type":"auto_fallback","guild_id":"{guild_id}","hash_result":5093,"holdout_name":null,"launch_signature":"{uuid}","location":"useGuildActionRows","location_stack":[],"name":"{redacted_string}","rendered_locale":"en-US","revision":2,"uptime_app":...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:ba8670b045a5e9fa7ff7923f29e51dc43f7b567b83248728596c36d34a131788
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"bypass_fatigue":false,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGDQa+xWnf8BJ4BAAAVAAAA","client_viewport_height":720,"client_viewport_width":1280,"content_count":0,"event_sequence_number":27,"fatigable_content_count":0,"group_name":"{redacted_string}","guild_id":"{guild_id}","launch_signature":"{uuid}","rendered_locale":"en-US","type":"NAGBAR_NOTICE_DOWNLOAD","uptime_app":0},"type":"dismissible_content_shown"}],"token":"{redacted}"}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:47a7ac59a8c17466f0b82603b056b74c470b6e5dc599989304a441e0c2769089
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGDQa+xWnf8BJ4BAAAWAAAA","client_viewport_height":720,"client_viewport_width":1280,"error_message":"You are being rate limited.","event_sequence_number":28,"launch_signature":"{uuid}","rendered_locale":"en-US","request_method":"get","status_code":429,"uptime_app":1,"url":"{redacted_string}"},"type":"network_action_user_survey_fetch"}],"token":"{redacted}"}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:8745150b3df439fe39632b972c7ac745346c3b6c808e348a429d2b0273d7624c
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"channel_id":"{channel_id}","channel_type":2,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGDQa+xWnf8BJ4BAAAXAAAA","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number":29,"game_id":null,"game_name":null,"guild_id":"{guild_id}","launch_signature":"{uuid}","rendered_locale":"en-US","uptime_app":1,"video_enabled":false,"video_layout":"no-chat","video_stream_count":0,"voice_state_count":0},"type":"video_layout_toggled"},{"properties":{"accessibility_features":524416,"client_app_state":"focused","client_heartbeat_sess...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:6260f5d1b0f63754cfde4dfc37898d78e3957d6fbdbd93efa425bbe219c78319
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGDQa+xWnf8BJ4BAAAaAAAA","client_viewport_height":720,"client_viewport_width":1280,"evaluation_id":"61f72003","event_sequence_number":32,"exposure_location":"voice call initiated","launch_signature":"{uuid}","rendered_locale":"en-US","unit_type":"user","uptime_app":1},"type":"experiment_user_evaluation_exposed"},{"properties":{"accessibility_features":524416,"assignment_loaded_from_cache":false,"assignment_session_id":"{redacted}","assignment_source":"ready_payload","bucket":0,"client_app_state":"...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:5bd6d5433da84118a426109e7cf0024bff5d8099a8642e8ca45935ead66b74a0
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"assignment_loaded_from_cache":false,"assignment_session_id":"{redacted}","assignment_source":"ready_payload","bucket":2,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"AWAITING_ENDPOINT","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGDQa+xWnf8BJ4BAAAgAAAA","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number":38,"excluded":false,"exposure_type":"auto","guild_id":"{guild_id}","hash_result":8827,"holdout_name":null,"launch_signature":"{uuid}","location":"VoiceChannelHistoryTracking","location_stack":[],"name":"{redacted_string}","rendered_locale":"en-US","revision":4,"uptime_...
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

- probable received: opcode 10
  - payload shape: sha256:1ea400906a171cedb7d42f268da0d397bbc43bd96fa7e5b1257462aa805cfb6b
  - payload sample redacted: {"d":{"_trace":["[\"gateway-prd-arm-us-east1-c-lcrv\",{\"micros\":0.0}]"],"heartbeat_interval":41250},"op":10,"s":null,"t":null}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable received: opcode 11
  - payload shape: sha256:1af1fbd23162b5c1fb73f89e2dcc4c8b7bb1ad05d938f7ce86ff7a2500c988c6
  - payload sample redacted: {"d":null,"op":11,"s":null,"t":null}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable sent: opcode 2
  - payload shape: sha256:843a77617e6ac40e91aba030ba78beb4bfb5fef43d2587ea2f63cde75d6a5616
  - payload sample redacted: {"d":{"capabilities":1734653,"client_state":{"guild_versions":{}},"properties":{"browser":"Chrome","browser_user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/{phone} Safari/537.36","browser_version":"{phone}","client_build_number":540600,"client_event_source":null,"client_launch_id":"{uuid}","device":"","has_client_mods":false,"is_fast_connect":true,"os":"Mac OS X","os_version":"10.15.7","referrer":"","referrer_current":"","referring_domain":"","referring_domain_current":"","release_channel":"stable","system_locale":"en-US"},"token":"{redacted}"},"op":2}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable sent: opcode 3
  - payload shape: sha256:7e1f0d649c466fd4ef3003ed273ac3bae39357bf12737093f96fcc5242303213
  - payload sample redacted: {"d":{"activities":[],"afk":false,"since":0,"status":"online"},"op":3}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable sent: opcode 37
  - payload shape: sha256:0963d99e3e99792aff47709a004b47d0e81905b7e8c02aae688fe7a66087b64b
  - payload sample redacted: {"d":{"subscriptions":{"{guild_id}":{"activities":true,"threads":true,"typing":true}}},"op":37}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- direct sent: opcode 4
  - payload shape: sha256:124f81e126e810bdf1a76e6b3bfd9dd2e29d729828ed3e3445654d9a11565427
  - payload sample redacted: {"d":{"channel_id":"{channel_id}","flags":2,"guild_id":"{guild_id}","self_deaf":false,"self_mute":true,"self_video":false},"op":4}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable sent: opcode 40
  - payload shape: sha256:bcef1e425dfdf2747e80676e2d40ddc355f90353ad80640b86d7b0fa436317c8
  - payload sample redacted: {"d":{"qos":{"active":true,"reasons":["foregrounded"],"ver":27},"seq":3},"op":40}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable sent: opcode 41
  - payload shape: sha256:9347a825b8f05e365dd2ece7cde37cfe2587aa14d2f972a58c366d740b98db6c
  - payload sample redacted: {"d":{"client_launch_id":"{uuid}","initialization_timestamp":"{timestamp}","session_id":"{redacted}"},"op":41}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable sent: opcode 43
  - payload shape: sha256:217cd0038e08d92e1387122731cfed63f0f96d43ea2c0fdcb01a84a1d2beac96
  - payload sample redacted: {"d":{"fields":["status","voice_start_time"],"guild_id":"{guild_id}"},"op":43}
- probable received: CHANNEL_INFO
  - payload shape: sha256:988f0f982410495272212f137285501bc05cf0ac3234aea358c2308fcf255b2d
  - payload sample redacted: {"d":{"channels":[{"id":"{channel_id}"},{"id":"{snowflake}"},{"id":"{channel_id}","status":null,"voice_start_time":null},{"id":"{channel_id}"},{"id":"{snowflake}"},{"id":"{snowflake}"}],"guild_id":"{guild_id}"},"op":0,"s":7,"t":"CHANNEL_INFO"}
  - static candidates:
    - high / fast-connect.38fb8ec2baeaa13d.js / module QUEST_PREVIEW_TOOL_2
- probable received: READY
  - payload shape: sha256:dfc896860c88ec20852d5bde6b6b1ac74ecb53619cadf011e85849675270fb69
  - payload sample redacted: {"d":{"_trace":["[\"gateway-prd-arm-us-east1-c-lcrv\",{\"micros\":186695,\"calls\":[\"id_created\",{\"micros\":2735,\"calls\":[]},\"session_lookup_time\",{\"micros\":6338,\"calls\":[]},\"session_lookup_finished\",{\"micros\":17,\"calls\":[]},\"sessions-prd-gcp-us-east1-c-104\",{\"micros\":176957,\"calls\":[\"start_session\",{\"micros\":168111,\"calls\":[\"prd-rpc-547f9f7987-xwzq4\",{\"micros\":71891,\"calls\":[\"get_user\",{\"micros\":16225},\"get_guilds\",{\"micros\":29180},\"user_settings_proto\",{\"micros\":34},\"relationships\",{\"micros\":10},\"game_relationships\",{\"micros\":1},\"friend_suggestion\",{\"micros\":25},\"connections\",{\"micros\":7},\"serialized_read_states\",{\"micros\":2},\"send_scheduled_deletion_message\",{\"micros\":1},\"sanitize_premium_perks\",{\"micros\":1},\...
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable received: READY_SUPPLEMENTAL
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
- probable received: THREAD_LIST_SYNC
  - payload shape: sha256:6e72127f8d471daea0bff4af8a53132a2b4f70cc6dee946489c60ce6f60dc53e
  - payload sample redacted: {"d":{"guild_id":"{guild_id}","most_recent_messages":[{"attachments":[],"author":"{redacted}","channel_id":"{snowflake}","channel_type":11,"components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":0,"id":"{snowflake}","is_thread_dispatch":true,"mention_everyone":false,"mention_roles":[],"mentions":[],"nonce":"{snowflake}","pinned":false,"position":0,"timestamp":"{phone}T22:48:{phone}+00:00","tts":false,"type":0},{"attachments":[],"author":"{redacted}","channel_id":"{message_id}","channel_type":11,"components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":0,"id":"{snowflake}","is_thread_dispatch":true,"mention_everyone":false,"mention_roles":[],"mentions":[],"nonce":"{snowflake}","pinned":false,"position":0,"timestamp":"{phon...
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable received: VOICE_CHANNEL_START_TIME_UPDATE
  - payload shape: sha256:6f6f920414036abd634ffb92d83b4c34f51401b7ba46e1ab22dce19d4c85322f
  - payload sample redacted: {"d":{"guild_id":"{guild_id}","id":"{channel_id}","voice_start_time":"{timestamp}"},"op":0,"s":9,"t":"VOICE_CHANNEL_START_TIME_UPDATE"}
- probable received: VOICE_SERVER_UPDATE
  - payload shape: sha256:6cf53e8fd6c1f04387bbd8351e264dcea551ff868741c43c11883b65a5c3e83c
  - payload sample redacted: {"d":{"endpoint":"c-fra17-6c0738ed.discord.media:2087","guild_id":"{guild_id}","token":"{redacted}"},"op":0,"s":10,"t":"VOICE_SERVER_UPDATE"}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- direct received: VOICE_STATE_UPDATE
  - payload shape: sha256:9d3b0a991b91ca1fc7506acf5da5e5f1ac1699d9db57f65c81701ef2001886e2
  - payload sample redacted: {"d":{"channel_id":"{channel_id}","connected_at":"{timestamp}","deaf":false,"guild_id":"{guild_id}","member":{"avatar":null,"banner":null,"communication_disabled_until":null,"deaf":false,"flags":0,"joined_at":"{phone}T09:12:{phone}+00:00","mute":false,"nick":null,"pending":false,"premium_since":null,"roles":[],"user":{"avatar":null,"avatar_decoration_data":null,"bot":false,"collectibles":null,"discriminator":"0","display_name":"{redacted_string}","display_name_styles":null,"global_name":"{redacted_string}","id":"{user_id}","primary_guild":null,"public_flags":0,"username":"{redacted_string}"}},"mute":false,"request_to_speak_timestamp":null,"self_deaf":false,"self_mute":true,"self_video":false,"session_id":"{redacted}","suppress":false,"user_id":"{user_id}"},"op":0,"s":8,"t":"VOICE_STATE_...
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
  - static candidates:
    - high / fast-connect.38fb8ec2baeaa13d.js / module QUEST_PREVIEW_TOOL_2

## Step: Disconnect from voice channel (disconnect-voice)

Actions:

- click / role:button / options:name
- expect-gateway / opcode 4 / sent
- expect-gateway / VOICE_STATE_UPDATE / received

HTTP:

- probable: GET /content-inventory/users/@me
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /games/detectable/exclusions
  - status codes: 200
  - response shape: sha256:038f30c12c43492c20a3f1758a65e95ca82971fc46f99725af85b2176cdf8610
  - response sample redacted: {"executables":["brocrashreporter.exe","config.exe","crashreportclient.exe","crosshairx.exe","dxsetup.exe","eaanticheat.gameservicelauncher.exe","eaanticheat.installer.exe","easyanticheat_setup.exe","gamerangeroemsetup.exe","install.exe","launcher.exe","launcherpatcher.exe","modlauncher.exe","pbsetup.exe","proxyinstallshield.exe","radiant_modtools.exe","rockstar-games-launcher.exe","sharex.exe","start_protected_game.exe","ue4prereqsetup_x64.exe","ueprereqsetup_x64.exe","ui32.exe","unitycrashhandler64.exe","vrmonitor.exe","wallpaper64.exe"],"patterns":["vcredist.*\\.exe$"]}
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /partner-sdk/storefront-config
  - status codes: 200
  - response shape: sha256:b07133b0287c9006dfebd738f0ded9ed1cf90d5c1aa26f7dba1a89612700725f
  - response sample redacted: {"announcement_modal_config":{"application_id":"{snowflake}","version":3},"promotion_end_datetime":"{phone}T18:00:00+00:00","promotional_sku_ids":["{snowflake}","{snowflake}","{snowflake}","{snowflake}"],"storefronts":[{"application_id":"{snowflake}","collectibles_shop_navigation_enabled":true,"excluded_platforms":["playstation"],"game_id":"{snowflake}","guild_id":"{snowflake}"},{"application_id":"{snowflake}","collectibles_shop_navigation_enabled":true,"excluded_platforms":["playstation","xbox"],"game_id":"{snowflake}","guild_id":"{snowflake}"}]}
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /partner-sdk/storefront-eligibility
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /promotions
  - status codes: 200
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - response sample redacted: []
  - static candidates:
    - high / fast-connect.38fb8ec2baeaa13d.js / module BILLING_PROMOTION_REDEMPTION
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /store/published-listings/skus
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
- probable: POST /science
  - status codes: 204
  - request shape: sha256:adc59ea991645a3c9472315f90621568c14f09c3696576707ebcca6fb5e99a4d
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"camera_device":"fake_device_0","camera_device_count":1,"channel_id":"{channel_id}","channel_type":2,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"AWAITING_ENDPOINT","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGDQa+xWnf8BJ4BAAAkAAAA","client_viewport_height":720,"client_viewport_width":1280,"connect_count":1,"connection_serial":0,"context":"default","event_sequence_number":42,"guild_id":"{guild_id}","hostname":"{redacted_string}","input_device":"Fake Default Audio Input","input_device_count":3,"is_muted":true,"join_voice_id":"{uuid}","launch_signature":"{uuid}","output_device":"Fake Default Audio O...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:6d111f7efbedae3372c83e53e6406b79e950c9644766bb56a2fdae4eb8c2941b
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"RTC_CONNECTING","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGDQa+xWnf8BJ4BAAAlAAAA","client_viewport_height":720,"client_viewport_width":1280,"evaluation_id":"61f72003","event_sequence_number":43,"experiment":"{phone}-ptt-education","exposure_location":"setInputMode","launch_signature":"{uuid}","rendered_locale":"en-US","tracked_variation_id":1,"unit_type":"user","uptime_app":2},"type":"experiment_user_evaluation_exposed"}],"token":"{redacted}"}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - request shape: sha256:4622d9dda6748f97bb07a10b4cde8e1d8c6a699da259b1b0ecfff4ca52df16d5
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"button_name":"{redacted_string}","channel_id":"{channel_id}","channel_type":2,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"RTC_CONNECTING","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGDQa+xWnf8BJ4BAAAmAAAA","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number":44,"guild_id":"{guild_id}","launch_signature":"{uuid}","location":"rtc panel","rendered_locale":"en-US","uptime_app":2},"type":"call_button_clicked"},{"properties":{"accessibility_features":524416,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_sta...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - request shape: sha256:9d290ee87ed7804f690f20847ef8c6847506657bbe2155d3fb9b67164ccaa25d
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"channel_hidden":false,"channel_id":"{channel_id}","channel_member_perms":"{snowflake}","channel_size_total":0,"channel_type":2,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"AWAITING_ENDPOINT","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGDQa+xWnf8BJ4BAAA4AAAA","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number":62,"guild_id":"{guild_id}","guild_is_vip":false,"guild_member_num_roles":0,"guild_member_perms":"{snowflake}","guild_num_channels":4,"guild_num_roles":3,"guild_num_text_channels":3,"guild_num_voice_channels":1,"guild_size_total":2,"impression_type":"modal","is_m...
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

- probable sent: opcode 0
  - payload shape: sha256:0a1871f1e928d8a09847179f01b54ee46f74952ce3824b74656d4258e350d8d0
  - payload sample redacted: {"d":{"channel_id":"{channel_id}","max_dave_protocol_version":1,"server_id":"{guild_id}","session_id":"{redacted}","streams":[{"quality":100,"rid":"100","type":"video"}],"token":"{redacted}","user_id":"{user_id}","video":true},"op":0}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- background sent: opcode 1
  - payload shape: sha256:0409fc0fe36bb503c0f5d4cd8e8616115f737a9af4cbd4394e0cfbdb44c7e16e
  - payload sample redacted: {"d":{"codecs":[{"name":"{redacted_string}","payload_type":111,"priority":1000,"rtx_payload_type":null,"type":"audio"},{"name":"{redacted_string}","payload_type":103,"priority":1000,"rtx_payload_type":104,"type":"video"},{"name":"{redacted_string}","payload_type":96,"priority":2000,"rtx_payload_type":97,"type":"video"},{"name":"{redacted_string}","payload_type":98,"priority":3000,"rtx_payload_type":99,"type":"video"}],"data":"a=extmap-allow-mixed\na=ice-ufrag:a8+i\na=ice-pwd:zacJ+NGcvBseSm392ve4QiRu\na=ice-options:trickle\na=fingerprint:sha-256 A5:11:62:18:1B:23:01:0D:92:E9:ED:C6:9F:71:CA:2F:F1:8B:0A:F1:E0:77:16:DD:A2:CD:53:D9:05:93:E7:49\na=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\na=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\na=extmap:3 http://www....
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable sent: opcode 16
  - payload shape: sha256:ee7961ba0eb984ee6f931a3d6183a19a8f00a44e618d66278b874437a1f8e12a
  - payload sample redacted: {"d":{},"op":16}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable received: opcode 16
  - payload shape: sha256:f1d3f30ea40efa32396e78067bea9d0e181e3edacf2f3e9c8e2399643095a1e5
  - payload sample redacted: {"d":{"rtc_worker":"1.6.61","voice":"0.21.6"},"op":16}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable received: opcode 2
  - payload shape: sha256:7179cf07c028eb746a2dc04fc370916edecf80207541e77d618605bf890a5a57
  - payload sample redacted: {"d":{"experiments":["fixed_keyframe_interval"],"ip":"{phone}","modes":["aead_aes256_gcm_rtpsize","aead_xchacha20_poly1305_rtpsize"],"port":19324,"ssrc":3337,"streams":[{"active":false,"quality":100,"rid":"100","rtx_ssrc":3339,"ssrc":3338,"type":"video"}]},"op":2}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- direct sent: opcode 4
  - payload shape: sha256:63a1ca04c7a758c4a070747202db7a1409dc8e5e983bb21775fc0e457f18b853
  - payload sample redacted: {"d":{"channel_id":null,"flags":2,"guild_id":null,"self_deaf":false,"self_mute":false,"self_video":false},"op":4}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable received: opcode 8
  - payload shape: sha256:54654aec56cbc8d94df37436bd7563e5a006f1c79e775c48e7c47bcb0a94d706
  - payload sample redacted: {"d":{"heartbeat_interval":13750,"v":8},"op":8}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable received: VOICE_CHANNEL_START_TIME_UPDATE
  - payload shape: sha256:f85d7ee9476db1bef44e02765c9ca3dd435950a08eba260e25a718b9c958e433
  - payload sample redacted: {"d":{"guild_id":"{guild_id}","id":"{channel_id}","voice_start_time":null},"op":0,"s":13,"t":"VOICE_CHANNEL_START_TIME_UPDATE"}
- probable received: VOICE_CHANNEL_STATUS_UPDATE
  - payload shape: sha256:f4811e9aa3ca2a2c51bc3bf696add67220c68cf4ee6df8cecc6d066971388e8d
  - payload sample redacted: {"d":{"guild_id":"{guild_id}","id":"{channel_id}","status":null},"op":0,"s":14,"t":"VOICE_CHANNEL_STATUS_UPDATE"}
- direct received: VOICE_STATE_UPDATE
  - payload shape: sha256:5e20a134f915bfe73b8ba87ad108a8dc40db8ef237fac9cc38d97c7bf64abfed
  - payload sample redacted: {"d":{"channel_id":null,"connected_at":"{timestamp}","deaf":false,"guild_id":"{guild_id}","member":{"avatar":null,"banner":null,"communication_disabled_until":null,"deaf":false,"flags":0,"joined_at":"{phone}T09:12:{phone}+00:00","mute":false,"nick":null,"pending":false,"premium_since":null,"roles":[],"user":{"avatar":null,"avatar_decoration_data":null,"bot":false,"collectibles":null,"discriminator":"0","display_name":"{redacted_string}","display_name_styles":null,"global_name":"{redacted_string}","id":"{user_id}","primary_guild":null,"public_flags":0,"username":"{redacted_string}"}},"mute":false,"request_to_speak_timestamp":null,"self_deaf":false,"self_mute":false,"self_video":false,"session_id":"{redacted}","suppress":false,"user_id":"{user_id}"},"op":0,"s":12,"t":"VOICE_STATE_UPDATE"}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
  - static candidates:
    - high / fast-connect.38fb8ec2baeaa13d.js / module QUEST_PREVIEW_TOOL_2

Review:

- unknown events: 0
- background events: 1
