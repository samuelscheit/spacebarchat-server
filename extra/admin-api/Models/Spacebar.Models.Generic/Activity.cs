using System.Text.Json.Serialization;

namespace Spacebar.Models.Generic;

public class Activity {
    [JsonPropertyName("name")]
    public required string Name { get; set; }

    [JsonPropertyName("type")]
    public ActivityType Type { get; set; }

    [JsonPropertyName("url"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Url { get; set; }

    [JsonPropertyName("created_at"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public long? CreatedAt { get; set; }

    [JsonPropertyName("timestamps"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ActivityTimestamps? Timestamps { get; set; }

    [JsonPropertyName("application_id"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonConverter(typeof(StringifiedJsonValueConverter))]
    public string? ApplicationId { get; set; }

    [JsonPropertyName("details"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Details { get; set; }

    [JsonPropertyName("state"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? State { get; set; }

    [JsonPropertyName("emoji"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ActivityEmoji? Emoji { get; set; }

    [JsonPropertyName("party"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ActivityParty? Party { get; set; }

    [JsonPropertyName("assets"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ActivityAssets? Assets { get; set; }

    [JsonPropertyName("secrets"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ActivitySecrets? Secrets { get; set; }

    [JsonPropertyName("instance"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? Instance { get; set; }

    [JsonPropertyName("flags"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Flags { get; set; }

    [JsonPropertyName("id"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Id { get; set; }

    [JsonPropertyName("sync_id"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? SyncId { get; set; }

    [JsonPropertyName("metadata"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ActivityMetadata? Metadata { get; set; }

    [JsonPropertyName("session_id"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? SessionId { get; set; }
}

public enum ActivityType {
    Game = 0,
    Streaming = 1,
    Listening = 2,
    Watching = 3,
    Custom = 4,
    Competing = 5,
}

public class ActivityTimestamps {
    [JsonPropertyName("start"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public long? Start { get; set; }

    [JsonPropertyName("end"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public long? End { get; set; }
}

public class ActivityEmoji {
    [JsonPropertyName("name")]
    public required string Name { get; set; }

    [JsonPropertyName("id"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonConverter(typeof(StringifiedJsonValueConverter))]
    public string? Id { get; set; }

    [JsonPropertyName("animated")]
    public bool Animated { get; set; }
}

public class ActivityParty {
    [JsonPropertyName("id"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Id { get; set; }

    [JsonPropertyName("size"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<int>? Size { get; set; }
}

public class ActivityAssets {
    [JsonPropertyName("large_image"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? LargeImage { get; set; }

    [JsonPropertyName("large_text"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? LargeText { get; set; }

    [JsonPropertyName("small_image"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? SmallImage { get; set; }

    [JsonPropertyName("small_text"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? SmallText { get; set; }
}

public class ActivitySecrets {
    [JsonPropertyName("join"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Join { get; set; }

    [JsonPropertyName("spectate"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Spectate { get; set; }

    [JsonPropertyName("match"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Match { get; set; }
}

public class ActivityMetadata {
    [JsonPropertyName("button_urls"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? ButtonUrls { get; set; }

    [JsonPropertyName("context_uri"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ContextUri { get; set; }

    [JsonPropertyName("album_id"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? AlbumId { get; set; }

    [JsonPropertyName("artist_ids"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? ArtistIds { get; set; }

    [JsonPropertyName("type"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Type { get; set; }
}
