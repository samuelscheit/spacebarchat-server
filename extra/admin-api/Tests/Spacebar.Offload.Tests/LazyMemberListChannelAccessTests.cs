using System.Globalization;
using System.Text.Json;
using Spacebar.GatewayOffload;
using Spacebar.Models.Db.Models;
using Spacebar.Models.Generic;
using Spacebar.Models.Generic.Constants;
using DbMember = Spacebar.Models.Db.Models.Member;

namespace Spacebar.Offload.Tests;

public class LazyMemberListChannelAccessTests {
    private static readonly ulong ViewChannel = (ulong)Permissions.ViewChannel;
    private static readonly ulong SendMessages = (ulong)Permissions.SendMessages;
    private static readonly ulong Administrator = (ulong)Permissions.Administrator;

    [Fact]
    public void GetMemberListIdUsesEveryoneWhenNoViewChannelOverwritesApply() {
        Assert.Equal("everyone", LazyMemberListChannelAccess.GetMemberListId([]));
        Assert.Equal("everyone", LazyMemberListChannelAccess.GetMemberListId([
            Overwrite("20", allow: SendMessages),
            Overwrite("30", deny: SendMessages),
        ]));
    }

    [Fact]
    public void GetMemberListIdUsesMurmurHashOfSortedViewChannelOverwrites() {
        var listId = LazyMemberListChannelAccess.GetMemberListId([
            Overwrite("30", deny: ViewChannel),
            Overwrite("40", allow: SendMessages),
            Overwrite("20", allow: ViewChannel),
        ]);

        // Matches murmurhash-js/murmurhash3_gc("allow:20,deny:30").toString().
        Assert.Equal("1021954172", listId);
    }

    [Fact]
    public void CanViewChannelDeniesRequesterWhenOverwriteRemovesViewChannel() {
        var everyone = Role(10, ViewChannel);
        var member = Member(1, [everyone]);
        var channel = Channel([
            Overwrite("10", deny: ViewChannel),
        ]);

        Assert.False(LazyMemberListChannelAccess.CanViewChannel(member, channel, guildOwnerId: 99));
    }

    [Fact]
    public void CanViewChannelAllowsGuildOwnerAndAdministrator() {
        var everyone = Role(10, 0);
        var admin = Role(20, Administrator);
        var deniedChannel = Channel([
            Overwrite("10", deny: ViewChannel),
            Overwrite("20", deny: ViewChannel),
        ]);

        Assert.True(LazyMemberListChannelAccess.CanViewChannel(Member(1, [everyone]), deniedChannel, guildOwnerId: 1));
        Assert.True(LazyMemberListChannelAccess.CanViewChannel(Member(2, [everyone, admin]), deniedChannel, guildOwnerId: 1));
    }

    [Fact]
    public void CanViewChannelAppliesEveryoneOverwriteWhenEveryoneRoleRelationIsMissing() {
        var channel = Channel([
            Overwrite("10", allow: ViewChannel),
        ]);

        Assert.True(LazyMemberListChannelAccess.CanViewChannel(Member(1, []), channel, guildOwnerId: 99));
    }

    [Fact]
    public void FilterVisibleMembersAppliesRoleDenyAndMemberAllowOverwrites() {
        var everyone = Role(10, ViewChannel);
        var deniedRole = Role(20, 0);
        var channel = Channel([
            // Member-specific overwrites must be applied after role overwrites
            // regardless of JSON order.
            Overwrite("2", allow: ViewChannel, type: 1),
            Overwrite("20", deny: ViewChannel),
        ]);
        var hiddenByRole = Member(1, [everyone, deniedRole]);
        var reAllowedMember = Member(2, [everyone, deniedRole]);
        var publicMember = Member(3, [everyone]);

        var visibleMembers = LazyMemberListChannelAccess
            .FilterVisibleMembers([hiddenByRole, reAllowedMember, publicMember], channel, guildOwnerId: 99)
            .Select(member => member.Id)
            .ToArray();

        Assert.Equal([2, 3], visibleMembers);
    }

    private static Channel Channel(IEnumerable<ChannelPermissionOverwrite> overwrites) => new() {
        Id = 100,
        GuildId = 10,
        PermissionOverwrites = JsonSerializer.Serialize(overwrites),
    };

    private static ChannelPermissionOverwrite Overwrite(string id, ulong allow = 0, ulong deny = 0, int type = 0) => new() {
        Id = id,
        Type = type,
        Allow = allow,
        Deny = deny,
    };

    private static DbMember Member(long id, ICollection<Role> roles) => new() {
        Id = id,
        GuildId = 10,
        Roles = roles,
        Bio = "",
        Settings = "{}",
    };

    private static Role Role(long id, ulong permissions) => new() {
        Id = id,
        GuildId = 10,
        Hoist = false,
        Name = id.ToString(CultureInfo.InvariantCulture),
        Permissions = permissions.ToString(CultureInfo.InvariantCulture),
        Colors = "{}",
    };
}
