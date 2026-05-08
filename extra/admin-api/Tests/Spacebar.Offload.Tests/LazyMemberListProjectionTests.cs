using System.Text.Json;
using System.Text.Json.Nodes;
using Spacebar.GatewayOffload;
using Spacebar.Models.Db.Models;
using Spacebar.Models.Gateway;
using DbMember = Spacebar.Models.Db.Models.Member;
using DbSession = Spacebar.Models.Db.Models.Session;

namespace Spacebar.Offload.Tests;

public class LazyMemberListProjectionTests {
    [Fact]
    public void BuildUpdateGroupsOnlineMembersByHoistedRolesAndOfflineMembers() {
        var guildRole = Role(10, 10, 0, hoist: false);
        var adminRole = Role(20, 10, 5, hoist: true);
        var cosmeticRole = Role(30, 10, 9, hoist: false);
        var lowHoistRole = Role(40, 10, 1, hoist: true);

        var update = LazyMemberListProjection.BuildUpdate(10, "everyone", [
            Member(1, "Zed", [guildRole], [Session("offline")]),
            Member(2, "Ada", [guildRole, adminRole, cosmeticRole], [Session("online", "{\"web\":\"online\"}")]),
            Member(3, "Bea", [guildRole, lowHoistRole], [Session("idle")]),
        ], [[0, 99]]);

        Assert.Equal("everyone", update.ListId);
        Assert.Equal(10, update.GuildId);
        Assert.Equal(2, update.OnlineCount);
        Assert.Equal(3, update.MemberCount);
        Assert.Equal(["20", "40", "offline"], update.Groups.Select(group => group.Id).ToArray());

        var op = Assert.IsType<GuildMemberListSyncOperation>(Assert.Single(update.Operations));
        Assert.Equal("SYNC", op.Operation);
        Assert.Equal([0, 99], op.Range);
        Assert.Equal(6, op.Items.Count);
        Assert.Equal("20", op.Items[0].Group?.Id);
        Assert.Equal(2, op.Items[1].Member?.User.Id);
        Assert.Equal([20, 30], op.Items[1].Member?.Roles);
        Assert.Equal("online", op.Items[1].Member?.Presence?.Status);
        Assert.Equal("online", op.Items[1].Member?.Presence?.ClientStatus.Web);
        Assert.Equal("40", op.Items[2].Group?.Id);
        Assert.Equal(3, op.Items[3].Member?.User.Id);
        Assert.Equal("offline", op.Items[4].Group?.Id);
        Assert.Equal(1, op.Items[5].Member?.User.Id);
        Assert.Equal("offline", op.Items[5].Member?.Presence?.Status);
    }

    [Fact]
    public void BuildUpdateSlicesRequestedRangesAfterGroupRows() {
        var guildRole = Role(10, 10, 0, hoist: false);
        var update = LazyMemberListProjection.BuildUpdate(10, "everyone", [
            Member(1, "Ada", [guildRole], [Session("online")]),
            Member(2, "Bea", [guildRole], [Session("online")]),
        ], [[1, 1], [-2, 0]]);

        Assert.Equal(2, update.Operations.Count);
        var first = Assert.IsType<GuildMemberListSyncOperation>(update.Operations[0]);
        Assert.Equal([1, 1], first.Range);
        Assert.Single(first.Items);
        Assert.Equal(1, first.Items[0].Member?.User.Id);

        var second = Assert.IsType<GuildMemberListSyncOperation>(update.Operations[1]);
        Assert.Equal([0, 0], second.Range);
        Assert.Single(second.Items);
        Assert.Equal("online", second.Items[0].Group?.Id);
    }

    [Fact]
    public void ToMessageSetsGatewayDispatchMetadata() {
        var update = LazyMemberListProjection.BuildUpdate(10, "everyone", [], []);
        var message = LazyMemberListProjection.ToMessage(99, update);

        Assert.Equal(LazyMemberListProjection.OriginName, message.Origin);
        Assert.Equal(LazyMemberListProjection.EventName, message.Event);
        Assert.Equal(99, message.UserId);
        Assert.Equal(10, message.GuildId);
        Assert.Same(update, message.Payload);
        Assert.NotNull(message.CreatedAt);
    }

    [Fact]
    public void BuildPresenceUsesPublicUserAndCurrentSession() {
        var guildRole = Role(10, 10, 0, hoist: false);
        var member = Member(1, "Ada", [guildRole], [Session("unknown", "{\"desktop\":\"online\"}")]);

        var presence = LazyMemberListProjection.BuildPresence(member);

        Assert.Equal(1, presence.User.Id);
        Assert.Equal("Ada", presence.User.Username);
        Assert.Equal("online", presence.Status);
        Assert.Equal("online", presence.ClientStatus.Desktop);
    }

    [Fact]
    public void BuildRequestedPresenceMessagesReturnsOnlyRequestedVisibleMembers() {
        var guildRole = Role(10, 10, 0, hoist: false);
        var ada = Member(1, "Ada", [guildRole], [Session("online", "{\"web\":\"online\"}")]);
        var bea = Member(2, "Bea", [guildRole], [Session("idle", "{\"desktop\":\"idle\"}")]);

        var messages = LazyMemberListProjection.BuildRequestedPresenceMessages(99, 10, [ada, bea], [2, 3]).ToArray();

        var message = Assert.Single(messages);
        Assert.Equal(LazyMemberListProjection.OriginName, message.Origin);
        Assert.Equal("PRESENCE_UPDATE", message.Event);
        Assert.Equal(99, message.UserId);
        Assert.Equal(10, message.GuildId);
        Assert.Equal(2, message.Payload.User.Id);
        Assert.Equal("Bea", message.Payload.User.Username);
        Assert.Equal("idle", message.Payload.Status);
        Assert.Equal("idle", message.Payload.ClientStatus.Desktop);
    }

    [Fact]
    public void GuildMemberListJsonUsesDiscordFieldNames() {
        var guildRole = Role(10, 10, 0, hoist: false);
        var update = LazyMemberListProjection.BuildUpdate(10, "everyone", [Member(1, "Ada", [guildRole], [Session("online")])], [[0, 1]]);

        var json = JsonSerializer.Serialize(update, new JsonSerializerOptions { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull });
        var root = JsonNode.Parse(json)!;

        Assert.Equal("10", root["guild_id"]!.GetValue<string>());
        Assert.Equal("SYNC", root["ops"]![0]!["op"]!.GetValue<string>());
        Assert.Equal("online", root["ops"]![0]!["items"]![0]!["group"]!["id"]!.GetValue<string>());
        Assert.Equal("1", root["ops"]![0]!["items"]![1]!["member"]!["user"]!["id"]!.GetValue<string>());
        Assert.Equal("1", root["ops"]![0]!["items"]![1]!["member"]!["presence"]!["user"]!["id"]!.GetValue<string>());
        Assert.False(root.AsObject().ContainsKey("GuildId"));
    }

    [Fact]
    public void MixedOffloadMessagesSerializeDataPayloads() {
        var guildRole = Role(10, 10, 0, hoist: false);
        var member = Member(1, "Ada", [guildRole], [Session("online")]);
        var update = LazyMemberListProjection.BuildUpdate(10, "everyone", [member], [[0, 1]]);
        object[] messages = [
            LazyMemberListProjection.ToPresenceMessage(99, 10, LazyMemberListProjection.BuildPresence(member)),
            LazyMemberListProjection.ToMessage(99, update),
        ];

        var json = JsonSerializer.Serialize(messages, new JsonSerializerOptions { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull });
        var root = JsonNode.Parse(json)!;

        Assert.Equal("PRESENCE_UPDATE", root[0]!["event"]!.GetValue<string>());
        Assert.Equal("Ada", root[0]!["data"]!["user"]!["username"]!.GetValue<string>());
        Assert.Equal("GUILD_MEMBER_LIST_UPDATE", root[1]!["event"]!.GetValue<string>());
        Assert.Equal("everyone", root[1]!["data"]!["id"]!.GetValue<string>());
    }

    private static DbMember Member(long id, string username, ICollection<Role> roles, ICollection<DbSession> sessions) {
        var user = new User {
            Id = id,
            Username = username,
            Discriminator = "0001",
            Bio = "",
            Data = "{}",
            Fingerprints = "[]",
            Sessions = sessions,
        };
        foreach (var session in sessions) session.User = user;

        return new DbMember {
            Id = id,
            GuildId = 10,
            IdNavigation = user,
            Roles = roles,
            Bio = "",
            Settings = "{}",
        };
    }

    private static Role Role(long id, long guildId, int position, bool hoist) => new() {
        Id = id,
        GuildId = guildId,
        Position = position,
        Hoist = hoist,
        Name = id.ToString(),
        Permissions = "0",
        Colors = "{}",
    };

    private static DbSession Session(string status, string clientStatus = "{}") => new() {
        SessionId = Guid.NewGuid().ToString(),
        Status = status,
        ClientStatus = clientStatus,
        Activities = "[]",
        ClientInfo = "{}",
        CreatedAt = DateTime.UnixEpoch,
        LastSeen = DateTime.UnixEpoch,
    };
}
