# Scenario Authoring

Each scenario should exercise one user-visible feature and expose explicit step boundaries.

```ts
export default defineFeature({
    id: "message.send.basic",
    title: "Send a plain text message",
    requiredFixtures: ["guild", "channels.general"],
    tags: ["messages", "http", "gateway"],
    expected: {
        http: [{ method: "POST", route: "/channels/{channel_id}/messages", step_id: "send-message" }],
        gateway: [{ direction: "received", event: "MESSAGE_CREATE", step_id: "send-message" }],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });
    },
});
```

Rules:

- Use locator and UI-state waits through the runner context.
- Use the shared action helpers (`fillRole`, `clickRole`, `contextClickRole`, `contextClickText`, `pressKey`, `setInputFilesByLabel`, etc.) for browser actions so reports can include redacted UI action labels without recording typed text, fixture IDs, selected text, or file paths.
- Resolve manifest-backed values through `ctx.fixture("<path>")`; do not hardcode local fixture file paths, raw IDs, or private labels inside scenario modules.
- Do not use blind sleeps.
- Make created content unique with the run ID.
- Clean up destructive state or use disposable fixtures.
- Scenarios tagged `destructive` must declare `safety.requiredDisposableFixtures`, and runtime preflight will refuse to run them unless `fixtures.local.json` lists those fixture paths under `disposable`.
- Declare known endpoints and Gateway events, but allow unknown observations to flow into the review queue.

For destructive scenarios:

```ts
export default defineFeature({
    id: "message.delete.basic",
    title: "Delete a message",
    requiredFixtures: ["guild", "channels.general", "messages.delete_target"],
    tags: ["messages", "http", "gateway", "destructive"],
    safety: {
        destructive: true,
        requiredDisposableFixtures: ["messages.delete_target"],
    },
    async run(ctx) {
        // ...
    },
});
```

The local fixture manifest should mark the target by fixture path, not by raw ID:

```json
{
    "messages": {
        "delete_target": "{message_id}"
    },
    "disposable": ["messages.delete_target"]
}
```

The built-in registry currently includes:

- `bootstrap.idle.session`: opens a fixture channel and records baseline authenticated app traffic.
- `navigation.channel_switch`: switches text channels and expects message history fetch traffic.
- `navigation.guild_switch`: switches guilds and expects guild channel load traffic.
- `navigation.dm_switch`: opens a direct message and expects message history fetch traffic.
- `message.send.basic`: sends a plain text message and expects `POST /channels/{channel_id}/messages` plus `MESSAGE_CREATE`.
- `message.edit.basic`: edits a fixture message and expects `PATCH /channels/{channel_id}/messages/{message_id}` plus `MESSAGE_UPDATE`.
- `message.delete.basic`: deletes a disposable fixture message and expects `DELETE /channels/{channel_id}/messages/{message_id}` plus `MESSAGE_DELETE`.
- `message.reaction.add`: adds a reaction and expects the reaction add route plus `MESSAGE_REACTION_ADD`.
- `message.reply.basic`: sends a reply and expects message create traffic.
- `message.pin.basic`: pins a message and expects the pin route plus `CHANNEL_PINS_UPDATE`.
- `message.upload.attachment`: uploads a small fixture file and expects attachment plus message create traffic.
- `read_state.message_ack`: creates an unread message boundary, marks the channel read, and expects the channel ack route.
- `read_state.mark_unread`: marks a message unread and expects the message ack route Discord currently emits for that action.
- `read_state.recent_mentions`: opens recent mentions and expects the user mentions route.
- `thread.create.basic`: creates a public thread and expects `POST /channels/{channel_id}/threads` plus `THREAD_CREATE`.
- `search.message.basic`: searches guild messages and expects the guild message search route.
- `search.member.basic`: searches guild members through mention autocomplete and expects Gateway member lookup traffic.
- `expressions.picker.basic`: opens the expression picker, sends a Unicode emoji, and expects message create traffic.
- `guild.role.edit.basic`: edits a fixture role and expects `PATCH /guilds/{guild_id}/roles/{role_id}` plus `GUILD_ROLE_UPDATE`.
- `channel.permission.edit`: edits a channel permission overwrite and expects the permission overwrite route.
- `settings.guild_notifications`: changes guild notification settings and expects the user guild settings route.
- `voice.join.basic`: joins a fixture voice channel and expects Gateway voice-state traffic.
- `voice.disconnect.basic`: joins then disconnects from a fixture voice channel and expects Gateway voice-state traffic.
- `voice.mute_toggle`: toggles voice mute and expects Gateway voice-state traffic.
- `voice.deafen_toggle`: toggles voice deafen and expects Gateway voice-state traffic.
- `experiments.visible_context`: opens visible experiment context and expects experiment fetch traffic.
