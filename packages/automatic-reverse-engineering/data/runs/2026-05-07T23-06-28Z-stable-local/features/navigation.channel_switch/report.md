# Feature: Switch text channels

Run: 2026-05-07T23-06-28Z-stable-local
Scenario: navigation.channel_switch
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

## Step: Open general channel (open-general)

Actions:

- goto-channel / fixture-channel:general
- expect-ready

HTTP:

- probable: GET /channels/{channel_id}
  - status codes: 200
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- background: GET /channels/{channel_id}/messages
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- background: GET /guilds/{guild_id}/entitlements
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
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/survey
  - status codes: 429
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- background: GET /users/@me/unclaimed-games
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- background: POST /guilds/{guild_id}/migrate-command-scope
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- background: POST /science
  - request shape: sha256:b2250594cbac35267a2e85ed6d37faf4dbc52740582f421c1da864745ccf8c57
  - request sample redacted: {"events":[{"properties":{"accessibility_features":128,"client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","event_sequence_number":1,"experimental_features":[],"launch_signature":"{uuid}","rendered_locale":"en-US","success":true,"uptime_app":0},"type":"libdiscore_loaded"},{"properties":{"accessibility_features":128,"client_app_state":"focused","client_heartbeat_initialization_timestamp":"{timestamp}","client_heartbeat_session_id":"{redacted}","client_heartbeat_version":27,"client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number"...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - request shape: sha256:46bff3d2916d9a4afe0b8dde4fde094617a17f44f2dd5038ec3016324b2ca491
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBFtXMl4gmnEBJ4BAAAKAAAA","client_viewport_height":720,"client_viewport_width":1280,"evaluation_id":"61f72003","event_sequence_number":16,"experiment":"2026-03-file-upload-powerup-holdout","exposure_location":"GuildPowerupsConstants","launch_signature":"{uuid}","rendered_locale":"en-US","tracked_variation_id":0,"unit_type":"user","uptime_app":1},"type":"experiment_user_evaluation_exposed"},{"properties":{"accessibility_features":524416,"assignment_loaded_from_cache":false,"assignment_session_id":"{...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- background: POST /science
  - request shape: sha256:ba8670b045a5e9fa7ff7923f29e51dc43f7b567b83248728596c36d34a131788
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"bypass_fatigue":false,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBFtXMl4gmnEBJ4BAAAVAAAA","client_viewport_height":720,"client_viewport_width":1280,"content_count":0,"event_sequence_number":27,"fatigable_content_count":0,"group_name":"{redacted_string}","guild_id":"{guild_id}","launch_signature":"{uuid}","rendered_locale":"en-US","type":"NAGBAR_NOTICE_DOWNLOAD","uptime_app":1},"type":"dismissible_content_shown"}],"token":"{redacted}"}
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
  - payload sample redacted: {"d":{"_trace":["[\"gateway-prd-arm-us-east1-b-60dj\",{\"micros\":0.0}]"],"heartbeat_interval":41250},"op":10,"s":null,"t":null}
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
  - payload shape: sha256:f87f6d759159e1c1d48f73b2b466a99707adecb24b146b592b822d483c5bc942
  - payload sample redacted: {"d":{"_trace":["[\"gateway-prd-arm-us-east1-b-60dj\",{\"micros\":568595,\"calls\":[\"id_created\",{\"micros\":1143,\"calls\":[]},\"session_lookup_time\",{\"micros\":285,\"calls\":[]},\"session_lookup_finished\",{\"micros\":17,\"calls\":[]},\"sessions-prd-gcp-us-east1-b-127\",{\"micros\":566404,\"calls\":[\"start_session\",{\"micros\":502872,\"calls\":[\"prd-rpc-547f9f7987-s94wx\",{\"micros\":246174,\"calls\":[\"get_user\",{\"micros\":131902},\"get_guilds\",{\"micros\":28972},\"user_settings_proto\",{\"micros\":1622},\"relationships\",{\"micros\":5868},\"game_relationships\",{\"micros\":5},\"friend_suggestion\",{\"micros\":44},\"connections\",{\"micros\":17},\"serialized_read_states\",{\"micros\":4},\"send_scheduled_deletion_message\",{\"micros\":2},\"sanitize_premium_perks\",{\"micros\...
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

## Step: Switch to secondary channel (switch-channel)

Actions:

- goto-channel / fixture-channel:secondary
- expect-ready
- expect-network / GET /channels/{channel_id}/messages

HTTP:

- direct: GET /channels/{channel_id}/messages
  - status codes: 200
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - response sample redacted: []
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /scheduled-maintenances/upcoming.json
  - status codes: 200
  - response shape: sha256:8b56135b00799c77d735c4fdc631449d82ad476c0e259a590568cfeacdba4eb0
  - response sample redacted: {"page":{"id":"srhpyqt94yxb","name":"{redacted_string}","time_zone":"America/Los_Angeles","updated_at":"{phone}T15:19:{phone}:00","url":"{redacted_string}"},"scheduled_maintenances":[]}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/unclaimed-games
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - request shape: sha256:47a7ac59a8c17466f0b82603b056b74c470b6e5dc599989304a441e0c2769089
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBFtXMl4gmnEBJ4BAAAWAAAA","client_viewport_height":720,"client_viewport_width":1280,"error_message":"You are being rate limited.","event_sequence_number":28,"launch_signature":"{uuid}","rendered_locale":"en-US","request_method":"get","status_code":429,"uptime_app":2,"url":"{redacted_string}"},"type":"network_action_user_survey_fetch"}],"token":"{redacted}"}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - request shape: sha256:f95be95fda0e81986281bfdf7a598173680c693efc1d897e44d5f5b6d5ab3926
  - request sample redacted: {"events":[{"properties":{"accessibility_features":128,"client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","event_sequence_number":1,"experimental_features":[],"launch_signature":"{uuid}","rendered_locale":"en-US","success":true,"uptime_app":0},"type":"libdiscore_loaded"},{"properties":{"accessibility_features":128,"client_app_state":"focused","client_heartbeat_initialization_timestamp":"{timestamp}","client_heartbeat_session_id":"{redacted}","client_heartbeat_version":27,"client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number"...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - request shape: sha256:88521a8b0257ce8dbb9e3aa2c6bc3cb0ba6c032092fff3444e4e181b0b316030
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"app_hardware_acceleration_enabled":true,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGBwFyBE3XEBJ4BAAAFAAAA","client_viewport_height":720,"client_viewport_width":1280,"css_compressed_byte_size":471888,"css_transfer_byte_size":0,"css_uncompressed_byte_size":2717830,"duration_ms_since_app_opened":1007,"event_sequence_number":9,"js_compressed_byte_size":517538,"js_transfer_byte_size":0,"js_uncompressed_byte_size":1555203,"launch_signature":"{uuid}","load_id":"{uuid}","rendered_locale":"en-US","screen_name":"{redacted_string}","total_compresse...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - request shape: sha256:ba8670b045a5e9fa7ff7923f29e51dc43f7b567b83248728596c36d34a131788
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"bypass_fatigue":false,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBGBwFyBE3XEBJ4BAAAHAAAA","client_viewport_height":720,"client_viewport_width":1280,"content_count":1,"event_sequence_number":11,"fatigable_content_count":0,"group_name":"{redacted_string}","guild_id":"{guild_id}","launch_signature":"{uuid}","rendered_locale":"en-US","type":"NAGBAR_NOTICE_DOWNLOAD","uptime_app":0},"type":"dismissible_content_shown"}],"token":"{redacted}"}
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
  - payload sample redacted: {"d":{"_trace":["[\"gateway-prd-arm-us-east1-c-4cs4\",{\"micros\":0.0}]"],"heartbeat_interval":41250},"op":10,"s":null,"t":null}
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
- probable sent: opcode 37
  - payload shape: sha256:3018d6a71b85de7f979e8205fccabbbc5c2e07858991470f1eba02cd7aa83578
  - payload sample redacted: {"d":{"subscriptions":{"{guild_id}":{"activities":true,"channels":{},"member_updates":false,"members":[],"thread_member_lists":[],"threads":true,"typing":true}}},"op":37}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable sent: opcode 4
  - payload shape: sha256:63a1ca04c7a758c4a070747202db7a1409dc8e5e983bb21775fc0e457f18b853
  - payload sample redacted: {"d":{"channel_id":null,"flags":2,"guild_id":null,"self_deaf":false,"self_mute":true,"self_video":false},"op":4}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable sent: opcode 40
  - payload shape: sha256:bcef1e425dfdf2747e80676e2d40ddc355f90353ad80640b86d7b0fa436317c8
  - payload sample redacted: {"d":{"qos":{"active":true,"reasons":["foregrounded"],"ver":27},"seq":1},"op":40}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable sent: opcode 41
  - payload shape: sha256:9347a825b8f05e365dd2ece7cde37cfe2587aa14d2f972a58c366d740b98db6c
  - payload sample redacted: {"d":{"client_launch_id":"{uuid}","initialization_timestamp":"{timestamp}","session_id":"{redacted}"},"op":41}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable received: READY
  - payload shape: sha256:f87f6d759159e1c1d48f73b2b466a99707adecb24b146b592b822d483c5bc942
  - payload sample redacted: {"d":{"_trace":["[\"gateway-prd-arm-us-east1-c-4cs4\",{\"micros\":248572,\"calls\":[\"id_created\",{\"micros\":1082,\"calls\":[]},\"session_lookup_time\",{\"micros\":6787,\"calls\":[]},\"session_lookup_finished\",{\"micros\":25,\"calls\":[]},\"sessions-prd-gcp-us-east1-c-64\",{\"micros\":240040,\"calls\":[\"start_session\",{\"micros\":191974,\"calls\":[\"prd-rpc-547f9f7987-khn4z\",{\"micros\":76525,\"calls\":[\"get_user\",{\"micros\":22006},\"get_guilds\",{\"micros\":13880},\"user_settings_proto\",{\"micros\":36},\"relationships\",{\"micros\":3733},\"game_relationships\",{\"micros\":2},\"friend_suggestion\",{\"micros\":20},\"connections\",{\"micros\":5},\"serialized_read_states\",{\"micros\":9},\"send_scheduled_deletion_message\",{\"micros\":2},\"sanitize_premium_perks\",{\"micros\":1},...
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable received: READY_SUPPLEMENTAL
  - payload shape: sha256:20f7f12876215f9cb7b67726824e3e32e11f0c0b7cd8aab1ce6a44281dddd82b
  - payload sample redacted: {"d":{"disclose":["pomelo"],"game_invites":[],"guilds":[{"activity_instances":[],"embedded_activities":[],"id":"{guild_id}","voice_states":[]},{"activity_instances":[],"embedded_activities":[],"id":"{guild_id}","voice_states":[]}],"lazy_private_channels":[],"merged_members":[[],[]],"merged_presences":{"friends":[{"activities":[{"content_classification":{"data":null,"loaded":true},"created_at":"{timestamp}","id":"custom","name":"{redacted_string}","state":"samuelscheit.com","type":4}],"client_status":{"web":"idle"},"hidden_activities":[],"processed_at_timestamp":"{timestamp}","restricted_application":null,"status":"idle","user_id":"{snowflake}"}],"guilds":[[],[]]},"user_activities":[]},"op":0,"s":2,"t":"READY_SUPPLEMENTAL"}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable received: THREAD_LIST_SYNC
  - payload shape: sha256:6e72127f8d471daea0bff4af8a53132a2b4f70cc6dee946489c60ce6f60dc53e
  - payload sample redacted: {"d":{"guild_id":"{guild_id}","most_recent_messages":[{"attachments":[],"author":"{redacted}","channel_id":"{snowflake}","channel_type":11,"components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":0,"id":"{snowflake}","is_thread_dispatch":true,"mention_everyone":false,"mention_roles":[],"mentions":[],"nonce":"{snowflake}","pinned":false,"position":0,"timestamp":"{phone}T22:48:{phone}+00:00","tts":false,"type":0}],"threads":[{"flags":0,"guild_id":"{guild_id}","id":"{snowflake}","last_message_id":"{snowflake}","member_count":1,"member_ids_preview":["{user_id}"],"message_count":1,"name":"{redacted_string}","owner_id":"{user_id}","parent_id":"{channel_id}","rate_limit_per_user":0,"thread_metadata":{"archive_timestamp":"{phone}T22:48:{phone}+00:00","archived":...
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events

Review:

- unknown events: 0
- background events: 27
