using System.Diagnostics.CodeAnalysis;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Spacebar.Models.Generic;

public class Presence {
    [JsonPropertyName("user")]
    public required PartialUser User { get; set; }

    [JsonPropertyName("guild_id"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]
    public long? GuildId { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = "unknown";

    [JsonPropertyName("activities")]
    public List<Activity> Activities { get; set; } = [];

    [JsonPropertyName("hidden_activities"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<Activity>? HiddenActivities { get; set; }

    [JsonPropertyName("client_status")]
    public ClientStatuses ClientStatus { get; set; } = new();

    [JsonPropertyName("has_played_game")]
    public bool? HasPlayedGame { get; set; }

    // Unsure if this is used outside of op14
    [JsonPropertyName("game")]
    public JsonObject? Game { get; set; }

    // Unsure if used outside of op14
    [JsonPropertyName("processed_at_timestamp")]
    public ulong? ProcessedAtTimestamp { get; set; }

    [SuppressMessage("ReSharper", "UnusedMember.Local")]
    public class ClientStatuses {
        [JsonPropertyName("desktop"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? Desktop { get; set; }

        [JsonPropertyName("mobile"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? Mobile { get; set; }

        [JsonPropertyName("web"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? Web { get; set; }

        [JsonPropertyName("embedded"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? Embedded { get; set; }

        [JsonPropertyName("vr"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? Vr { get; set; }
    }
}
