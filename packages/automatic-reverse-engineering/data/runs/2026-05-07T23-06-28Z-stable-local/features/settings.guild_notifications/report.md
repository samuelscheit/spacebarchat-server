# Feature: Change guild notification settings

Run: 2026-05-07T23-06-28Z-stable-local
Scenario: settings.guild_notifications
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

## Step: Open notification settings (open-notifications)

Actions:

- goto-channel / fixture-channel:general
- expect-ready
- click / role:button / options:name
- click / role:menuitem / options:name

HTTP:

- probable: GET /channels/{channel_id}
  - status codes: 200
  - response shape: sha256:077b118ece7e4e9000beb16448d707923550ae39c8a977c71392d10d5c09b2af
  - response sample redacted: {"flags":0,"guild_id":"{guild_id}","icon_emoji":{"id":null,"name":"{redacted_string}"},"id":"{channel_id}","last_message_id":"{snowflake}","last_pin_timestamp":"{phone}T00:14:{phone}+00:00","name":"{redacted_string}","nsfw":false,"parent_id":"{snowflake}","permission_overwrites":[{"allow":"0","deny":"2048","id":"{guild_id}","type":0},{"allow":"0","deny":"0","id":"{role_id}","type":0}],"position":0,"rate_limit_per_user":0,"theme_color":null,"topic":null,"type":0}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /channels/{channel_id}/messages
  - status codes: 200
  - response shape: sha256:924f1474ca8ae3816f9b7ce9a6de2182e00d54f703f18ad9bd5b39ea11c75f1b
  - response sample redacted: [{"attachments":[],"author":"{redacted}","channel_id":"{channel_id}","components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":32,"id":"{snowflake}","mention_everyone":false,"mention_roles":[],"mentions":[],"pinned":false,"thread":{"bitrate":64000,"flags":0,"guild_id":"{guild_id}","id":"{snowflake}","last_message_id":"{snowflake}","member_count":1,"member_ids_preview":["{user_id}"],"message_count":1,"name":"{redacted_string}","owner_id":"{user_id}","parent_id":"{channel_id}","rate_limit_per_user":0,"rtc_region":null,"thread_metadata":{"archive_timestamp":"{phone}T00:24:{phone}+00:00","archived":false,"auto_archive_duration":4320,"create_timestamp":"{phone}T00:24:{phone}+00:00","locked":false},"total_message_sent":1,"type":11,"user_limit":0},"timestamp":"{...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: GET /channels/{channel_id}/messages
  - status codes: 200
  - response shape: sha256:91ca620f8de166a2ee2f65c16ccfa2d2d3c153f2f6eab406beea5b6f69ca6cf9
  - response sample redacted: [{"attachments":[],"author":"{redacted}","channel_id":"{channel_id}","components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":0,"id":"{message_id}","mention_everyone":false,"mention_roles":[],"mentions":[],"pinned":false,"reactions":[{"burst_colors":[],"burst_count":0,"burst_me":false,"count":1,"count_details":{"burst":0,"normal":1},"emoji":{"id":null,"name":"{redacted_string}"},"me":true,"me_burst":false}],"timestamp":"{phone}T23:11:{phone}+00:00","tts":false,"type":0},{"attachments":[],"author":"{redacted}","channel_id":"{channel_id}","components":[],"content":"{redacted_string}","edited_timestamp":null,"embeds":[],"flags":0,"id":"{message_id}","mention_everyone":false,"mention_roles":[],"mentions":[],"pinned":true,"timestamp":"{phone}T23:11:{phone}+00...
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
  - response sample redacted: {"global":false,"message":"You are being rate limited.","retry_after":78953.911}
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
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"assignment_loaded_from_cache":false,"assignment_session_id":"{redacted}","assignment_source":"ready_payload","bucket":1,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBHfch426WYIBZ4BAAAMAAAA","client_viewport_height":720,"client_viewport_width":1280,"event_sequence_number":18,"excluded":false,"exposure_type":"auto_fallback","guild_id":"{guild_id}","hash_result":5093,"holdout_name":null,"launch_signature":"{uuid}","location":"useGuildActionRows","location_stack":[],"name":"{redacted_string}","rendered_locale":"en-US","revision":2,"uptime_app":...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:ba8670b045a5e9fa7ff7923f29e51dc43f7b567b83248728596c36d34a131788
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"bypass_fatigue":false,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBHfch426WYIBZ4BAAAVAAAA","client_viewport_height":720,"client_viewport_width":1280,"content_count":0,"event_sequence_number":27,"fatigable_content_count":0,"group_name":"{redacted_string}","guild_id":"{guild_id}","launch_signature":"{uuid}","rendered_locale":"en-US","type":"NAGBAR_NOTICE_DOWNLOAD","uptime_app":1},"type":"dismissible_content_shown"}],"token":"{redacted}"}
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:bac98951e73d25ebbb469ac71e9962f21ec79b662c49bb38520f48eacc0620cf
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_uuid":"FhCA6HzRHBHfch426WYIBZ4BAAAWAAAA","client_viewport_height":720,"client_viewport_width":1280,"error_message":"You are being rate limited.","event_sequence_number":28,"launch_signature":"{uuid}","rendered_locale":"en-US","request_method":"get","status_code":429,"uptime_app":2,"url":"{redacted_string}"},"type":"network_action_user_survey_fetch"},{"properties":{"accessibility_features":524416,"bypass_fatigue":true,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memor...
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
  - payload sample redacted: {"d":{"_trace":["[\"gateway-prd-arm-us-east1-d-19w6\",{\"micros\":0.0}]"],"heartbeat_interval":41250},"op":10,"s":null,"t":null}
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
- probable sent: opcode 4
  - payload shape: sha256:63a1ca04c7a758c4a070747202db7a1409dc8e5e983bb21775fc0e457f18b853
  - payload sample redacted: {"d":{"channel_id":null,"flags":2,"guild_id":null,"self_deaf":false,"self_mute":true,"self_video":false},"op":4}
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
- probable sent: opcode 8
  - payload shape: sha256:ca306c45a770a8d17dca287f7e44694f510f4780141ec13545c57d3ab3bf55f2
  - payload sample redacted: {"d":{"guild_id":["{guild_id}"],"presences":false,"user_ids":["{user_id}"]},"op":8}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable received: CHANNEL_INFO
  - payload shape: sha256:988f0f982410495272212f137285501bc05cf0ac3234aea358c2308fcf255b2d
  - payload sample redacted: {"d":{"channels":[{"id":"{channel_id}"},{"id":"{snowflake}"},{"id":"{channel_id}","status":null,"voice_start_time":null},{"id":"{channel_id}"},{"id":"{snowflake}"},{"id":"{snowflake}"}],"guild_id":"{guild_id}"},"op":0,"s":7,"t":"CHANNEL_INFO"}
  - static candidates:
    - high / fast-connect.38fb8ec2baeaa13d.js / module QUEST_PREVIEW_TOOL_2
- probable received: GUILD_MEMBERS_CHUNK
  - payload shape: sha256:7c1d40bb32d5b4efeb01ef169f1670126cd390d4a51e77ccee19f7054df6281b
  - payload sample redacted: {"d":{"chunk_count":1,"chunk_index":0,"guild_id":"{guild_id}","members":[{"avatar":null,"banner":null,"communication_disabled_until":null,"deaf":false,"flags":0,"joined_at":"{phone}T22:46:{phone}+00:00","mute":false,"nick":null,"pending":false,"premium_since":null,"roles":["{snowflake}"],"user":{"avatar":null,"avatar_decoration_data":null,"bot":true,"collectibles":null,"discriminator":"0807","display_name":null,"display_name_styles":null,"global_name":null,"id":"{user_id}","primary_guild":null,"public_flags":0,"username":"{redacted_string}"}}],"not_found":[]},"op":0,"s":8,"t":"GUILD_MEMBERS_CHUNK"}
  - docs:
    - official_gateway_reference: https://docs.discord.com/developers/events/gateway
    - userdoccers_gateway_events: https://docs.discord.food/gateway/gateway-events
- probable received: READY
  - payload shape: sha256:8d653eab66b3150f3d685217dc768aa5e47bad6896146d55080debba51fd5f33
  - payload sample redacted: {"d":{"_trace":["[\"gateway-prd-arm-us-east1-d-19w6\",{\"micros\":130453,\"calls\":[\"id_created\",{\"micros\":976,\"calls\":[]},\"session_lookup_time\",{\"micros\":586,\"calls\":[]},\"session_lookup_finished\",{\"micros\":10,\"calls\":[]},\"sessions-prd-gcp-us-east1-d-111\",{\"micros\":128205,\"calls\":[\"start_session\",{\"micros\":120144,\"calls\":[\"prd-rpc-6f7f8b856-9x9ck\",{\"micros\":57441,\"calls\":[\"get_user\",{\"micros\":7505},\"get_guilds\",{\"micros\":15383},\"user_settings_proto\",{\"micros\":36},\"relationships\",{\"micros\":3520},\"game_relationships\",{\"micros\":4},\"friend_suggestion\",{\"micros\":31},\"connections\",{\"micros\":9},\"serialized_read_states\",{\"micros\":2},\"send_scheduled_deletion_message\",{\"micros\":1},\"sanitize_premium_perks\",{\"micros\":1},\"g...
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

## Step: Change notification setting (change-notifications)

Actions:

- click / selector / value redacted
- click / role:button / options:name
- expect-network / PATCH /users/@me/guilds/settings

HTTP:

- probable: GET /guilds/{guild_id}/integrations
  - status codes: 200
  - response shape: sha256:068dd3c92aadb60e2d78392ace887e0ca551334dcc5d20cee51cb24fbf7f17f6
  - response sample redacted: [{"account":{"id":"{user_id}","name":"{redacted_string}"},"application":{"bot":{"accent_color":null,"avatar":null,"avatar_decoration_data":null,"banner":null,"banner_color":null,"bot":true,"clan":null,"collectibles":null,"discriminator":"0807","display_name_styles":null,"flags":0,"global_name":null,"id":"{user_id}","primary_guild":null,"public_flags":0,"username":"{redacted_string}"},"description":"{redacted_string}","icon":null,"id":"{user_id}","is_discoverable":false,"is_monetized":false,"is_verified":false,"name":"{redacted_string}","role_connections_verification_url":null,"summary":"","type":null},"enabled":true,"id":"{snowflake}","name":"{redacted_string}","scopes":["bot","applications.commands"],"type":"discord","user":{"accent_color":null,"avatar":null,"avatar_decoration_data":nu...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- direct: PATCH /users/@me/guilds/settings
  - status codes: 200
  - request shape: sha256:ec98506bc6fa87f67c538ddffd1ab73c7b8e48f95420e8e5eba5c82cb84075a8
  - request sample redacted: {"guilds":{"{guild_id}":{"message_notifications":1}}}
  - response shape: sha256:d6a6f6136f03cfcc3b3c53b4012430eace712d2c08033b170213b498fc6836bd
  - response sample redacted: [{"channel_overrides":[],"flags":0,"guild_id":"{guild_id}","hide_muted_channels":false,"message_notifications":1,"mobile_push":true,"mute_config":null,"mute_scheduled_events":false,"muted":false,"notify_highlights":0,"suppress_everyone":false,"suppress_roles":false,"version":54}]
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply
- probable: POST /science
  - status codes: 204
  - request shape: sha256:76e18921a765df446a7700e8601a6d1fad0842438766bab06500e7b4c3814f47
  - request sample redacted: {"events":[{"properties":{"accessibility_features":524416,"approx_seconds_since_last_everyone_mention":null,"approx_seconds_since_last_guild_everyone_mention":null,"approx_seconds_since_last_guild_mention":null,"approx_seconds_since_last_guild_notification":null,"approx_seconds_since_last_guild_role_mention":null,"approx_seconds_since_last_mention":null,"approx_seconds_since_last_notification":null,"approx_seconds_since_last_role_mention":null,"channel_hidden":false,"channel_id":"{channel_id}","channel_member_perms":"{snowflake}","channel_size_total":0,"channel_type":0,"client_app_state":"focused","client_heartbeat_session_id":"{redacted}","client_performance_memory":0,"client_rtc_state":"DISCONNECTED","client_send_timestamp":"{timestamp}","client_track_timestamp":"{timestamp}","client_...
  - docs:
    - official_api_reference: https://docs.discord.com/developers/reference
    - userdoccers_reference: https://docs.discord.food/reference
  - static candidates:
    - high / sentry.36796a94df4938db.js / module apply

Gateway:

- probable received: USER_GUILD_SETTINGS_UPDATE
  - payload shape: sha256:8ec76272e9ec16d07fdd45dcb3d55116deb76baa25447459ad9f42725806cc0b
  - payload sample redacted: {"d":{"channel_overrides":[],"flags":0,"guild_id":"{guild_id}","hide_muted_channels":false,"message_notifications":1,"mobile_push":true,"mute_config":null,"mute_scheduled_events":false,"muted":false,"notify_highlights":0,"suppress_everyone":false,"suppress_roles":false,"version":54},"op":0,"s":9,"t":"USER_GUILD_SETTINGS_UPDATE"}
