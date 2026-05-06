using System.Text.Json;
using System.Text.Json.Nodes;
using Spacebar.Models.Gateway;

namespace Spacebar.Models.Gateway.Tests;

public class GuildRoleUpdatePayloadTests {
    [Fact]
    public void SerializesRoleUpdatePayloadWithDiscordFieldNames() {
        var payload = new GuildRoleUpdatePayload {
            GuildId = 1006649183970562092,
            Role = new GuildRoleUpdateRole {
                Id = 1391303296148639051,
                GuildId = 1006649183970562092,
                Color = 99839,
                Hoist = false,
                Managed = false,
                Mentionable = true,
                Name = "Spacebar Maintainer",
                Permissions = "8",
                Position = 5,
                UnicodeEmoji = "",
                Flags = 0,
                Colors = new GuildRoleColors {
                    PrimaryColor = 99839,
                    SecondaryColor = 16711680,
                },
                Tags = new GuildRoleTags {
                    BotId = 111111111111111111,
                },
            },
        };

        var json = JsonSerializer.Serialize(payload);
        var node = JsonNode.Parse(json)!;

        Assert.Equal("1006649183970562092", node["guild_id"]!.GetValue<string>());
        Assert.Equal("1391303296148639051", node["role"]!["id"]!.GetValue<string>());
        Assert.Equal("1006649183970562092", node["role"]!["guild_id"]!.GetValue<string>());
        Assert.Equal(99839, node["role"]!["color"]!.GetValue<int>());
        Assert.False(node["role"]!["hoist"]!.GetValue<bool>());
        Assert.False(node["role"]!["managed"]!.GetValue<bool>());
        Assert.True(node["role"]!["mentionable"]!.GetValue<bool>());
        Assert.Equal("Spacebar Maintainer", node["role"]!["name"]!.GetValue<string>());
        Assert.Equal("8", node["role"]!["permissions"]!.GetValue<string>());
        Assert.Equal(5, node["role"]!["position"]!.GetValue<int>());
        Assert.Equal("", node["role"]!["unicode_emoji"]!.GetValue<string>());
        Assert.Equal(0, node["role"]!["flags"]!.GetValue<int>());
        Assert.Equal(99839, node["role"]!["colors"]!["primary_color"]!.GetValue<int>());
        Assert.Equal(16711680, node["role"]!["colors"]!["secondary_color"]!.GetValue<int>());
        Assert.Equal("111111111111111111", node["role"]!["tags"]!["bot_id"]!.GetValue<string>());
    }

    [Fact]
    public void OmitsOptionalRoleFieldsWhenUnset() {
        var payload = new GuildRoleUpdatePayload {
            GuildId = 1,
            Role = new GuildRoleUpdateRole {
                Id = 2,
                GuildId = 1,
                Name = "role",
                Permissions = "0",
                Colors = new GuildRoleColors {
                    PrimaryColor = 0,
                },
            },
        };

        var json = JsonSerializer.Serialize(payload);
        var node = JsonNode.Parse(json)!;

        Assert.Null(node["role"]!["icon"]);
        Assert.Null(node["role"]!["tags"]);
        Assert.Equal(0, node["role"]!["colors"]!["primary_color"]!.GetValue<int>());
        Assert.Equal("2", node["role"]!["id"]!.GetValue<string>());
    }
}
