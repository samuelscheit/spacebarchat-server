using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Spacebar.Models.Gateway;

public class ChannelStatusesRequest {
    [JsonRequired]
    [JsonPropertyName("guild_id")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]

    public JsonValue GuildIdRawValue { get; set; } = null!;

    [JsonIgnore]
    public long? GuildId {
        get => GuildIdRawValue.GetValueKind() == JsonValueKind.String ? GuildIdRawValue.GetValue<long>() : null;
        [MemberNotNull] set => GuildIdRawValue = JsonValue.Create(value!)!;
    }

    [JsonIgnore]
    public List<long>? GuildIds {
        get => GuildIdRawValue.GetValueKind() == JsonValueKind.Array ? GuildIdRawValue.AsArray().Deserialize<List<long>>() : null;
        [MemberNotNull] set => GuildIdRawValue = JsonValue.Create(value!)!;
    }
}

public class ChannelInfoRequest : ChannelStatusesRequest {
    [JsonPropertyName("fields")]
    public required List<string> Fields { get; set; }
}

public class ChannelStatus {
    [JsonPropertyName("id")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]
    public long ChannelId { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = null!;
}

public class ChannelStatusesResponse {
    [JsonPropertyName("guild_id")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]
    public long GuildId { get; set; }

    [JsonPropertyName("channels")]
    public List<ChannelStatus> Channels { get; set; } = null!;
}

[JsonConverter(typeof(ChannelInfoJsonConverter))]
public class ChannelInfo {
    [JsonPropertyName("id")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]
    public required long ChannelId { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonIgnore]
    public bool IncludeStatus { get; set; }

    [JsonPropertyName("voice_start_time")]
    public DateTimeOffset? VoiceStartTime { get; set; }

    [JsonIgnore]
    public bool IncludeVoiceStartTime { get; set; }
}

public class ChannelInfoJsonConverter : JsonConverter<ChannelInfo> {
    public override ChannelInfo Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) {
        using var document = JsonDocument.ParseValue(ref reader);
        var root = document.RootElement;

        var channel = new ChannelInfo {
            ChannelId = ReadChannelId(root.GetProperty("id")),
        };

        if (root.TryGetProperty("status", out var status)) {
            channel.IncludeStatus = true;
            channel.Status = status.ValueKind == JsonValueKind.Null ? null : status.GetString();
        }

        if (root.TryGetProperty("voice_start_time", out var voiceStartTime)) {
            channel.IncludeVoiceStartTime = true;
            channel.VoiceStartTime = voiceStartTime.ValueKind == JsonValueKind.Null ? null : voiceStartTime.GetDateTimeOffset();
        }

        return channel;
    }

    public override void Write(Utf8JsonWriter writer, ChannelInfo value, JsonSerializerOptions options) {
        writer.WriteStartObject();
        writer.WriteString("id", value.ChannelId.ToString(CultureInfo.InvariantCulture));

        if (value.IncludeStatus) {
            if (value.Status is null) {
                writer.WriteNull("status");
            } else {
                writer.WriteString("status", value.Status);
            }
        }

        if (value.IncludeVoiceStartTime) {
            if (value.VoiceStartTime is null) {
                writer.WriteNull("voice_start_time");
            } else {
                writer.WriteString("voice_start_time", value.VoiceStartTime.Value);
            }
        }

        writer.WriteEndObject();
    }

    private static long ReadChannelId(JsonElement id) =>
        id.ValueKind == JsonValueKind.String
            ? long.Parse(id.GetString()!, CultureInfo.InvariantCulture)
            : id.GetInt64();
}

public class ChannelInfoResponse {
    [JsonPropertyName("guild_id")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]
    public long GuildId { get; set; }

    [JsonPropertyName("channels")]
    public List<ChannelInfo> Channels { get; set; } = null!;
}
