# Feature: Switch to a direct message

Run: 2026-05-07T23-06-28Z-stable-local
Scenario: navigation.dm_switch
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

## Step: Switch to DM (switch-dm)

Actions:

- goto-channel / fixture-channel:dm
- expect-ready
- expect-network / GET /channels/{channel_id}

HTTP:

- direct: GET /channels/{channel_id}
  - status codes: 200
  - response shape: sha256:dc18212ba5bcd0d72abc591a7c7759475ca5d8da0e7aeb5e5ac78425bafb3911
  - response sample redacted: {"flags":0,"id":"{channel_id}","last_message_id":null,"recipients":[{"accent_color":null,"avatar":null,"avatar_decoration_data":null,"banner":null,"banner_color":null,"bot":true,"clan":null,"collectibles":null,"discriminator":"0807","display_name_styles":null,"flags":0,"global_name":null,"id":"{user_id}","primary_guild":null,"public_flags":0,"username":"{redacted_string}"}],"type":1}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /promotions
  - status codes: 200
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - response sample redacted: []
  - static candidates:
    - high / fast-connect.38fb8ec2baeaa13d.js / module BILLING_PROMOTION_REDEMPTION
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
- probable: GET /users/@me/applications/{application_id}/entitlements
  - status codes: 200
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - response sample redacted: []
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/applications/{application_id}/entitlements
  - status codes: 200
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - response sample redacted: []
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/entitlements
  - status codes: 200
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - response sample redacted: []
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/referrals/eligibility
  - status codes: 404
  - response shape: sha256:3bb88ebf7c7a07d030d70b5d6416732792c9c0f8a69626b5de08a83d57ba8be2
  - response sample redacted: {"code":0,"message":"404: Not Found"}
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /users/@me/survey
  - status codes: 429
  - response shape: sha256:03c791a2bff466a1f917bc4db83ed31cddd76160e2ce2fe94070faff2bd6e015
  - response sample redacted: {"global":false,"message":"You are being rate limited.","retry_after":83072.684}
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:25b71998ba563fa1b22dc034608d328bf5865a7d30d2c0aeee21dd99ce7e9ff7
  - request sample redacted: {"events":[{"properties":{"accessibility_features":128,"client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","event_sequence_number":1,"experimental_features":[],"launch_signature":"{uuid}","rendered_locale":"en-US","success":true,"uptime_app":0},"type":"libdiscore_loaded"},{"properties":{"accessibility_features":128,"client_app_state":"focused","client_heartbeat_initialization_timestamp":"{timestamp}","client_heartbeat_session_id":"{redacted}","client_heartbeat_version":27,"client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number"...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:47a7ac59a8c17466f0b82603b056b74c470b6e5dc599989304a441e0c2769089
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBFUhBZhm47JBJ4BAAAQAAAA","client_viewport_height":720,"client_viewport_width":1280,"error_message":"You are being rate limited.","event_sequence_number":21,"launch_signature":"{uuid}","rendered_locale":"en-US","request_method":"get","status_code":429,"uptime_app":1,"url":"{redacted_string}"},"type":"network_action_user_survey_fetch"}],"token":"{redacted}"}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:f33265e90449be4776e36f7937fd009e0d2db65fa48054b8d03b6814397de83e
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"bypass_fatigue":false,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBFUhBZhm47JBJ4BAAARAAAA","client_viewport_height":720,"client_viewport_width":1280,"content_count":1,"event_sequence_number":22,"fatigable_content_count":0,"group_name":"{redacted_string}","guild_id":null,"launch_signature":"{uuid}","rendered_locale":"en-US","type":"NAGBAR_NOTICE_DOWNLOAD","uptime_app":1},"type":"dismissible_content_shown"}],"token":"{redacted}"}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:07327848d6f8c081cf17050e2ac224b8de88c5e51da24dc31e9607dc58333e67
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"app_hardware_acceleration_enabled":true,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBFUhBZhm47JBJ4BAAASAAAA","client_viewport_height":720,"client_viewport_width":1280,"css_compressed_byte_size":469961,"css_transfer_byte_size":0,"css_uncompressed_byte_size":3202751,"duration_ms_since_app_opened":3582,"event_sequence_number":23,"js_compressed_byte_size":517539,"js_transfer_byte_size":0,"js_uncompressed_byte_size":2097642,"launch_signature":"{uuid}","load_id":"{uuid}","rendered_locale":"en-US","screen_name":"{redacted_string}","total_compress...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
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
- probable received: READY
  - payload shape: sha256:cd2f45c474f217c58e5fe1347c4f3a94507c654c08897e19915ae0293f8c551a
  - payload sample redacted: {"d":{"_trace":["[\"gateway-prd-arm-us-east1-c-j329\",{\"micros\":157831,\"calls\":[\"id_created\",{\"micros\":1792,\"calls\":[]},\"session_lookup_time\",{\"micros\":1230,\"calls\":[]},\"session_lookup_finished\",{\"micros\":13,\"calls\":[]},\"sessions-prd-gcp-us-east1-c-116\",{\"micros\":154130,\"calls\":[\"start_session\",{\"micros\":125710,\"calls\":[\"prd-rpc-547f9f7987-ftpbb\",{\"micros\":63625,\"calls\":[\"get_user\",{\"micros\":10177},\"get_guilds\",{\"micros\":17215},\"user_settings_proto\",{\"micros\":34},\"relationships\",{\"micros\":3802},\"game_relationships\",{\"micros\":2},\"friend_suggestion\",{\"micros\":24},\"connections\",{\"micros\":7},\"serialized_read_states\",{\"micros\":1},\"send_scheduled_deletion_message\",{\"micros\":2},\"sanitize_premium_perks\",{\"micros\":9}...
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

Review:

- unknown events: 0
- background events: 15
