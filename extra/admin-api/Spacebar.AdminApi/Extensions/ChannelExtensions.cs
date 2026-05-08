using System.Text.Json;
using System.Text.Json.Nodes;
using Spacebar.Models.Gateway;
using Spacebar.Models.Generic;
using DbChannel = Spacebar.Models.Db.Models.Channel;

namespace Spacebar.AdminApi.Extensions;

/// <summary>
/// Maps database channels to public gateway/API channel payloads.
/// </summary>
public static class ChannelExtensions {
    /// <summary>
    /// Converts a persisted channel into the JSON shape emitted by TypeScript channel events.
    /// </summary>
    public static PublicChannel ToPublicChannel(this DbChannel channel) {
        return new PublicChannel {
            Id = channel.Id,
            CreatedAt = channel.CreatedAt,
            Type = (int)channel.Type,
            GuildId = channel.GuildId,
            Name = channel.Name,
            Icon = channel.Icon,
            LastMessageId = channel.LastMessageId,
            ParentId = channel.ParentId,
            OwnerId = channel.OwnerId,
            DefaultAutoArchiveDuration = channel.DefaultAutoArchiveDuration,
            PermissionOverwrites = DeserializePermissionOverwrites(channel.PermissionOverwrites),
            VideoQualityMode = channel.VideoQualityMode,
            Bitrate = channel.Bitrate,
            UserLimit = channel.UserLimit,
            Nsfw = channel.Nsfw,
            RateLimitPerUser = channel.RateLimitPerUser,
            Topic = channel.Topic,
            Flags = channel.Flags,
            DefaultThreadRateLimitPerUser = channel.DefaultThreadRateLimitPerUser,
            ThreadMetadata = DeserializeJsonObject(channel.ThreadMetadata),
            MemberCount = channel.MemberCount,
            MessageCount = channel.MessageCount,
            TotalMessageSent = channel.TotalMessageSent,
            AppliedTags = channel.AppliedTags,
            LastPinTimestamp = channel.LastPinTimestamp,
            Status = channel.Status
        };
    }

    private static IReadOnlyList<ChannelPermissionOverwrite>? DeserializePermissionOverwrites(string? value) {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return JsonSerializer.Deserialize<List<ChannelPermissionOverwrite>>(value);
    }

    private static JsonNode? DeserializeJsonObject(string? value) {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return JsonNode.Parse(value);
    }
}
