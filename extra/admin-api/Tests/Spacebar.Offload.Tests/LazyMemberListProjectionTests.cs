using System.Text.Json;
using Spacebar.GatewayOffload.Extensions.Gateway;
using Spacebar.Models.Generic;
using Spacebar.Models.Generic.Constants;

namespace Spacebar.Offload.Tests;

public class LazyMemberListProjectionTests {
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("[]")]
    public void GetMemberListIdReturnsEveryoneForMissingOrEmptyOverwrites(string? permissionOverwritesJson) {
        Assert.Equal("everyone", LazyMemberListProjection.GetMemberListId(permissionOverwritesJson));
    }

    [Fact]
    public void GetMemberListIdReturnsEveryoneWhenOverwritesDoNotAffectViewChannel() {
        var permissionOverwritesJson = SerializeOverwrites(new ChannelPermissionOverwrite {
            Id = "123",
            Allow = (ulong)Permissions.SendMessages,
            Deny = (ulong)Permissions.Connect,
        });

        Assert.Equal("everyone", LazyMemberListProjection.GetMemberListId(permissionOverwritesJson));
    }

    [Theory]
    [InlineData("allow:123", "3352883465")]
    [InlineData("deny:456", "3460824376")]
    [InlineData("allow:123,deny:456", "2371338780")]
    [InlineData("allow:42,deny:7", "2990536224")]
    public void GetMemberListIdMatchesGatewayMurmurHashVectors(string sortedPermissionList, string expectedHash) {
        var overwrites = sortedPermissionList
            .Split(',')
            .Select(entry => {
                var parts = entry.Split(':');
                return new ChannelPermissionOverwrite {
                    Id = parts[1],
                    Allow = parts[0] == "allow" ? (ulong)Permissions.ViewChannel : 0,
                    Deny = parts[0] == "deny" ? (ulong)Permissions.ViewChannel : 0,
                };
            })
            .ToArray();

        Assert.Equal(expectedHash, LazyMemberListProjection.GetMemberListId(SerializeOverwrites(overwrites)));
    }

    [Fact]
    public void GetMemberListIdSortsPermissionEntriesBeforeHashing() {
        var permissionOverwritesJson = SerializeOverwrites(
            new ChannelPermissionOverwrite { Id = "7", Deny = (ulong)Permissions.ViewChannel },
            new ChannelPermissionOverwrite { Id = "42", Allow = (ulong)Permissions.ViewChannel }
        );

        Assert.Equal("2990536224", LazyMemberListProjection.GetMemberListId(permissionOverwritesJson));
    }

    [Fact]
    public void GetMemberListIdUsesAllowWhenOverwriteBothAllowsAndDeniesViewChannel() {
        var permissionOverwritesJson = SerializeOverwrites(new ChannelPermissionOverwrite {
            Id = "123",
            Allow = (ulong)Permissions.ViewChannel,
            Deny = (ulong)Permissions.ViewChannel,
        });

        Assert.Equal("3352883465", LazyMemberListProjection.GetMemberListId(permissionOverwritesJson));
    }

    [Fact]
    public void GetMemberListIdReadsStringEncodedPermissionNumbersFromDatabaseJson() {
        const string permissionOverwritesJson = """
            [{"id":"123","type":0,"allow":"1024","deny":"0"}]
            """;

        Assert.Equal("3352883465", LazyMemberListProjection.GetMemberListId(permissionOverwritesJson));
    }

    private static string SerializeOverwrites(params ChannelPermissionOverwrite[] overwrites) => JsonSerializer.Serialize(overwrites);
}
