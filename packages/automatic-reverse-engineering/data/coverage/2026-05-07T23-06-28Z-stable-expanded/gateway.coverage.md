# Gateway Coverage

## opcode 10

- catalog: Hello (spacebar-source)
- directions: received
- features: bootstrap.idle.session, message.send.basic, navigation.channel_switch
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:1ea400906a171cedb7d42f268da0d397bbc43bd96fa7e5b1257462aa805cfb6b

## opcode 11

- catalog: Heartbeat_ACK (spacebar-source)
- directions: received
- features: bootstrap.idle.session, message.send.basic, navigation.channel_switch
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:1af1fbd23162b5c1fb73f89e2dcc4c8b7bb1ad05d938f7ce86ff7a2500c988c6

## opcode 2

- catalog: Identify (spacebar-source)
- directions: sent
- features: bootstrap.idle.session, message.send.basic, navigation.channel_switch
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:843a77617e6ac40e91aba030ba78beb4bfb5fef43d2587ea2f63cde75d6a5616

## opcode 3

- catalog: Presence_Update (spacebar-source)
- directions: sent
- features: bootstrap.idle.session, message.send.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:7e1f0d649c466fd4ef3003ed273ac3bae39357bf12737093f96fcc5242303213

## opcode 37

- catalog: Guild_Subscriptions_Bulk (spacebar-source)
- directions: sent
- features: bootstrap.idle.session, message.send.basic, navigation.channel_switch, navigation.guild_switch, search.message.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:0963d99e3e99792aff47709a004b47d0e81905b7e8c02aae688fe7a66087b64b, sha256:3018d6a71b85de7f979e8205fccabbbc5c2e07858991470f1eba02cd7aa83578

## opcode 4

- catalog: Voice_State_Update (spacebar-source)
- directions: sent
- features: bootstrap.idle.session, message.send.basic, navigation.channel_switch
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:63a1ca04c7a758c4a070747202db7a1409dc8e5e983bb21775fc0e457f18b853

## opcode 40

- catalog: SetQoS (spacebar-source)
- directions: sent
- features: bootstrap.idle.session, message.send.basic, navigation.channel_switch
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:bcef1e425dfdf2747e80676e2d40ddc355f90353ad80640b86d7b0fa436317c8

## opcode 41

- catalog: ClientInitSession (spacebar-source)
- directions: sent
- features: bootstrap.idle.session, message.send.basic, navigation.channel_switch
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:9347a825b8f05e365dd2ece7cde37cfe2587aa14d2f972a58c366d740b98db6c

## opcode 43

- directions: sent
- features: bootstrap.idle.session, message.send.basic, navigation.guild_switch
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:217cd0038e08d92e1387122731cfed63f0f96d43ea2c0fdcb01a84a1d2beac96

## opcode 8

- catalog: Request_Guild_Members (spacebar-source)
- directions: sent
- features: expressions.picker.basic, message.reply.basic, message.send.basic, message.upload.attachment, navigation.guild_switch, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, search.member.basic, search.message.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:a10adee2b7019715c25a9493bc284ce0f84b26f3a2bb1ec6c00e095e149da252, sha256:ca306c45a770a8d17dca287f7e44694f510f4780141ec13545c57d3ab3bf55f2

## CHANNEL_INFO

- directions: received
- features: bootstrap.idle.session, message.send.basic, navigation.guild_switch
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:36862976ac03f2c49fbb9bc3c18c483008d01eb48c18e522b8755c75a047a539

## GUILD_MEMBERS_CHUNK

- catalog: GuildMembersChunk (spacebar-source)
- directions: received
- features: expressions.picker.basic, message.reply.basic, message.send.basic, message.upload.attachment, navigation.guild_switch, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, search.member.basic, search.message.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:74c760541ae6bd1e2054224b149a33279d98ffcb08c0bc8bfc31f4d8bc645744, sha256:7c1d40bb32d5b4efeb01ef169f1670126cd390d4a51e77ccee19f7054df6281b

## MESSAGE_ACK

- directions: received
- features: read_state.mark_unread, read_state.message_ack
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:0e9ea7be4159474d586c9c7096e1f14baebf0cc56719d5591149a2a2e7f61e38, sha256:94144c1a18b9f31cd2e4847ec6695ed2c9da2a7b7b23c6677113d4a41d2fb3ec

## MESSAGE_CREATE

- catalog: MessageCreate (spacebar-source)
- directions: received
- features: expressions.picker.basic, message.reply.basic, message.send.basic, message.upload.attachment
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:13c4b8069d168edf9e0aae9760a5de4c9caf1f07527c56944a858d01d0534c48, sha256:d24cd55eb17c03e4fb3f32ef3f65c2b08afd4428112301dcdff0f87ab0f5baed

## READY

- catalog: Ready (spacebar-source)
- directions: received
- features: bootstrap.idle.session, expressions.picker.basic, message.reply.basic, message.send.basic, message.upload.attachment, navigation.channel_switch, navigation.dm_switch, navigation.guild_switch, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, search.member.basic, search.message.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:c3019f4385b71a41815f6819401393d2ed49a5f6ac7c8e81b993d7d8ce116d8a, sha256:cd2f45c474f217c58e5fe1347c4f3a94507c654c08897e19915ae0293f8c551a, sha256:f87f6d759159e1c1d48f73b2b466a99707adecb24b146b592b822d483c5bc942

## READY_SUPPLEMENTAL

- catalog: ReadySupplemental (spacebar-source)
- directions: received
- features: bootstrap.idle.session, message.send.basic, navigation.channel_switch
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:20f7f12876215f9cb7b67726824e3e32e11f0c0b7cd8aab1ce6a44281dddd82b

## SESSIONS_REPLACE

- catalog: SessionsReplace (spacebar-source)
- directions: received
- features: bootstrap.idle.session, expressions.picker.basic, message.reply.basic, message.send.basic, message.upload.attachment, navigation.channel_switch, navigation.dm_switch, navigation.guild_switch, read_state.mark_unread, read_state.message_ack, read_state.recent_mentions, search.member.basic, search.message.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:2fc1d0710087be43b84eff23481731955591ddbded58ddaf115b9c8238bed5fd, sha256:e705006a2f5b68e160c64ca431f6b31a67cd3316ba437a7545e7acf69dcfd43c

## THREAD_LIST_SYNC

- catalog: ThreadListSync (spacebar-source)
- directions: received
- features: bootstrap.idle.session, message.send.basic, navigation.channel_switch, navigation.guild_switch
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:6e72127f8d471daea0bff4af8a53132a2b4f70cc6dee946489c60ce6f60dc53e, sha256:d472054853b3eca920baeba428f678ac1834cc6b4ab998a1888e3324b035b354

## TYPING_START

- catalog: TypingStart (spacebar-source)
- directions: received
- features: message.upload.attachment
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- payload shapes: sha256:c234b2665e425481f08860d2ade36c9552813982cff0fee4fe36172e23597148
