using System.Text.Json;
using System.Text.Json.Nodes;
using Spacebar.AdminApi.Extensions;
using DbChannel = Spacebar.Models.Db.Models.Channel;

namespace Spacebar.AdminApi.Tests;

public class ChannelExtensionsTests {
    [Fact]
    public void ToPublicChannelSerializesDiscordChannelShape() {
        var channel = new DbChannel {
            Id = 1088915993558450176,
            CreatedAt = new DateTime(2026, 5, 6, 10, 11, 12, DateTimeKind.Utc),
            Type = 0,
            GuildId = 1088915993558450177,
            Name = "general",
            LastMessageId = 1088915993558450178,
            ParentId = 1088915993558450179,
            OwnerId = 1088915993558450180,
            PermissionOverwrites = """
                [{"id":"1088915993558450181","type":0,"allow":"1024","deny":"0"}]
                """,
            ThreadMetadata = """
                {"archived":false,"auto_archive_duration":60}
                """,
            Nsfw = true,
            Flags = 16,
            DefaultThreadRateLimitPerUser = 30,
            AppliedTags = ["1088915993558450182"],
            Status = "active",
        };

        var json = JsonSerializer.Serialize(channel.ToPublicChannel());
        var node = JsonNode.Parse(json)!;

        Assert.Equal("1088915993558450176", node["id"]!.GetValue<string>());
        Assert.Equal("1088915993558450177", node["guild_id"]!.GetValue<string>());
        Assert.Equal("1088915993558450178", node["last_message_id"]!.GetValue<string>());
        Assert.Equal("1088915993558450179", node["parent_id"]!.GetValue<string>());
        Assert.Equal("1088915993558450180", node["owner_id"]!.GetValue<string>());
        Assert.Equal("general", node["name"]!.GetValue<string>());
        Assert.True(node["nsfw"]!.GetValue<bool>());
        Assert.Equal(16, node["flags"]!.GetValue<int>());
        Assert.Equal(30, node["default_thread_rate_limit_per_user"]!.GetValue<int>());
        Assert.Equal("1088915993558450181", node["permission_overwrites"]![0]!["id"]!.GetValue<string>());
        Assert.Equal("1024", node["permission_overwrites"]![0]!["allow"]!.GetValue<string>());
        Assert.False(node["thread_metadata"]!["archived"]!.GetValue<bool>());
        Assert.Equal("1088915993558450182", node["applied_tags"]![0]!.GetValue<string>());
        Assert.Equal("active", node["status"]!.GetValue<string>());
        Assert.False(node.AsObject().ContainsKey("Id"));
        Assert.False(node.AsObject().ContainsKey("GuildId"));
        Assert.False(node.AsObject().ContainsKey("Guild"));
        Assert.False(node.AsObject().ContainsKey("MessageChannels"));
    }

    [Fact]
    public void ToPublicChannelOmitsNullableFieldsWhenUnset() {
        var channel = new DbChannel {
            Id = 1,
            CreatedAt = DateTime.UnixEpoch,
            Type = 0,
            Nsfw = false,
            Flags = 0,
        };

        var json = JsonSerializer.Serialize(channel.ToPublicChannel());
        var node = JsonNode.Parse(json)!;

        Assert.Equal("1", node["id"]!.GetValue<string>());
        Assert.Equal(0, node["type"]!.GetValue<int>());
        Assert.False(node["nsfw"]!.GetValue<bool>());
        Assert.Equal(0, node["flags"]!.GetValue<int>());
        Assert.Null(node["guild_id"]);
        Assert.Null(node["permission_overwrites"]);
        Assert.Null(node["thread_metadata"]);
    }
}
