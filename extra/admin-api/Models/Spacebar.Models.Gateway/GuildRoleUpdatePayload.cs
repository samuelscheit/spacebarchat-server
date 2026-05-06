using System.Text.Json.Serialization;

namespace Spacebar.Models.Gateway;

public class GuildRoleUpdatePayload {
    [JsonPropertyName("guild_id")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]
    public required long GuildId { get; set; }

    [JsonPropertyName("role")]
    public required GuildRoleUpdateRole Role { get; set; }
}

public class GuildRoleUpdateRole {
    [JsonPropertyName("id")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]
    public required long Id { get; set; }

    [JsonPropertyName("guild_id")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]
    public required long GuildId { get; set; }

    [JsonPropertyName("color")]
    public int Color { get; set; }

    [JsonPropertyName("hoist")]
    public bool Hoist { get; set; }

    [JsonPropertyName("managed")]
    public bool Managed { get; set; }

    [JsonPropertyName("mentionable")]
    public bool Mentionable { get; set; }

    [JsonPropertyName("name")]
    public required string Name { get; set; }

    [JsonPropertyName("permissions")]
    public required string Permissions { get; set; }

    [JsonPropertyName("position")]
    public int Position { get; set; }

    [JsonPropertyName("unicode_emoji")]
    public string? UnicodeEmoji { get; set; }

    [JsonPropertyName("flags")]
    public int Flags { get; set; }

    [JsonPropertyName("icon"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Icon { get; set; }

    [JsonPropertyName("tags"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public GuildRoleTags? Tags { get; set; }

    [JsonPropertyName("colors")]
    public required GuildRoleColors Colors { get; set; }
}

public class GuildRoleTags {
    [JsonPropertyName("bot_id"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]
    public long? BotId { get; set; }

    [JsonPropertyName("integration_id"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)]
    public long? IntegrationId { get; set; }

    [JsonPropertyName("premium_subscriber"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? PremiumSubscriber { get; set; }
}

public class GuildRoleColors {
    [JsonPropertyName("primary_color")]
    public int PrimaryColor { get; set; }

    [JsonPropertyName("secondary_color"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? SecondaryColor { get; set; }

    [JsonPropertyName("tertiary_color"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? TertiaryColor { get; set; }
}
