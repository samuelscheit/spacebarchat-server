using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Spacebar.Models.Generic;

namespace Spacebar.Models.Gateway;

public class PublicChannel {
    [JsonPropertyName("id")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]
    public required long Id { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("type")]
    public int Type { get; set; }

    [JsonPropertyName("guild_id"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]
    public long? GuildId { get; set; }

    [JsonPropertyName("name"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Name { get; set; }

    [JsonPropertyName("icon"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Icon { get; set; }

    [JsonPropertyName("last_message_id"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]
    public long? LastMessageId { get; set; }

    [JsonPropertyName("parent_id"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]
    public long? ParentId { get; set; }

    [JsonPropertyName("owner_id"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]
    public long? OwnerId { get; set; }

    [JsonPropertyName("default_auto_archive_duration"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? DefaultAutoArchiveDuration { get; set; }

    [JsonPropertyName("permission_overwrites"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IEnumerable<ChannelPermissionOverwrite>? PermissionOverwrites { get; set; }

    [JsonPropertyName("video_quality_mode"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? VideoQualityMode { get; set; }

    [JsonPropertyName("bitrate"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? Bitrate { get; set; }

    [JsonPropertyName("user_limit"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? UserLimit { get; set; }

    [JsonPropertyName("nsfw")]
    public bool Nsfw { get; set; }

    [JsonPropertyName("rate_limit_per_user"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? RateLimitPerUser { get; set; }

    [JsonPropertyName("topic"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Topic { get; set; }

    [JsonPropertyName("flags")]
    public int Flags { get; set; }

    [JsonPropertyName("default_thread_rate_limit_per_user"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? DefaultThreadRateLimitPerUser { get; set; }

    [JsonPropertyName("thread_metadata"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public JsonNode? ThreadMetadata { get; set; }

    [JsonPropertyName("member_count"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? MemberCount { get; set; }

    [JsonPropertyName("message_count"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? MessageCount { get; set; }

    [JsonPropertyName("total_message_sent"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? TotalMessageSent { get; set; }

    [JsonPropertyName("applied_tags"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? AppliedTags { get; set; }

    [JsonPropertyName("last_pin_timestamp"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DateTime? LastPinTimestamp { get; set; }

    [JsonPropertyName("status"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Status { get; set; }
}
