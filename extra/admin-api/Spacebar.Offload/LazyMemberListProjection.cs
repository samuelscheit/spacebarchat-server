using System.Text.Json;
using Spacebar.DataMappings.Generic;
using Spacebar.Interop.Replication.Abstractions;
using DbMember = Spacebar.Models.Db.Models.Member;
using DbSession = Spacebar.Models.Db.Models.Session;
using Spacebar.Models.Gateway;
using Spacebar.Models.Generic;

namespace Spacebar.GatewayOffload;

public static class LazyMemberListProjection {
    public const string EventName = "GUILD_MEMBER_LIST_UPDATE";
    public const string OriginName = "OFFLOAD_LAZY_REQUEST";

    public static GuildMemberListUpdate BuildUpdate(
        long guildId,
        string listId,
        IReadOnlyCollection<DbMember> members,
        IEnumerable<IReadOnlyList<int>> ranges
    ) {
        var snapshot = BuildSnapshot(guildId, members);

        return new GuildMemberListUpdate {
            ListId = listId,
            GuildId = guildId,
            OnlineCount = snapshot.OnlineCount,
            MemberCount = members.Count,
            Groups = snapshot.Groups,
            Operations = ranges.Select(range => BuildSyncOperation(snapshot.Items, range)).ToList<BaseGuildMemberListUpdateOperation>(),
        };
    }

    public static ReplicationMessage<GuildMemberListUpdate> ToMessage(long userId, GuildMemberListUpdate update) => new() {
        Origin = OriginName,
        UserId = userId,
        GuildId = update.GuildId,
        Event = EventName,
        CreatedAt = DateTime.Now,
        Payload = update,
    };

    private static LazyMemberListSnapshot BuildSnapshot(long guildId, IReadOnlyCollection<DbMember> members) {
        var displayRoles = GetOrderedDisplayRoles(guildId, members);
        var membersWithPresence = members
            .Select(member => new MemberListEntry(
                GetDisplayRoleId(guildId, member, displayRoles),
                member,
                GetPublicSession(member)
            ))
            .OrderByDescending(entry => IsOnline(entry.Session))
            .ThenByDescending(entry => GetHighestRolePosition(guildId, entry.Member))
            .ThenBy(entry => entry.Member.Roles.Where(role => role.Id != guildId).OrderBy(role => role.Id).Select(role => role.Id.ToString()).FirstOrDefault() ?? string.Empty, StringComparer.Ordinal)
            .ThenBy(entry => entry.Member.IdNavigation.Username, StringComparer.Ordinal)
            .ThenBy(entry => entry.Member.Id)
            .ToList();

        var onlineMembers = membersWithPresence.Where(entry => IsOnline(entry.Session)).ToList();
        var offlineMembers = membersWithPresence.Where(entry => !IsOnline(entry.Session)).ToList();
        var groups = new List<GuildMemberListGroupCount>();
        var items = new List<GuildMemberListSyncItem>();

        foreach (var roleId in displayRoles) {
            var roleMembers = onlineMembers.Where(entry => entry.DisplayRoleId == roleId).ToList();
            if (roleMembers.Count == 0) continue;

            var group = new GuildMemberListGroupCount {
                Id = roleId == guildId ? "online" : roleId.ToString(),
                Count = roleMembers.Count,
            };
            groups.Add(group);
            items.Add(new GuildMemberListSyncItem { Group = group });
            items.AddRange(roleMembers.Select(entry => ToSyncItem(entry.Member, entry.Session)));
        }

        if (offlineMembers.Count > 0) {
            var group = new GuildMemberListGroupCount {
                Id = "offline",
                Count = offlineMembers.Count,
            };
            groups.Add(group);
            items.Add(new GuildMemberListSyncItem { Group = group });
            items.AddRange(offlineMembers.Select(entry => ToSyncItem(entry.Member, entry.Session)));
        }

        return new LazyMemberListSnapshot(items, groups, onlineMembers.Count);
    }

    private static GuildMemberListSyncOperation BuildSyncOperation(IReadOnlyList<GuildMemberListSyncItem> items, IReadOnlyList<int> range) {
        var (start, end) = GetRangeBounds(range);
        var count = end - start + 1;
        var rangedItems = start >= items.Count ? [] : items.Skip(start).Take(count).ToList();

        return new GuildMemberListSyncOperation {
            Operation = "SYNC",
            Range = [start, end],
            Items = rangedItems,
        };
    }

    private static (int Start, int End) GetRangeBounds(IReadOnlyList<int> range) {
        var start = range.Count > 0 ? range[0] : 0;
        var end = range.Count > 1 ? range[1] : 99;
        start = Math.Max(start, 0);
        end = Math.Max(end, start);
        return (start, end);
    }

    private static List<long> GetOrderedDisplayRoles(long guildId, IReadOnlyCollection<DbMember> members) {
        var hoistedRoles = members
            .SelectMany(member => member.Roles)
            .Where(role => role.Id != guildId && role.Hoist)
            .GroupBy(role => role.Id)
            .Select(group => group.First())
            .OrderByDescending(role => role.Position)
            .ThenBy(role => role.Id)
            .Select(role => role.Id)
            .ToList();

        hoistedRoles.Add(guildId);
        return hoistedRoles;
    }

    private static long GetDisplayRoleId(long guildId, DbMember member, IReadOnlyList<long> displayRoles) =>
        displayRoles.FirstOrDefault(roleId => roleId != guildId && member.Roles.Any(role => role.Id == roleId), guildId);

    private static int GetHighestRolePosition(long guildId, DbMember member) =>
        member.Roles.Where(role => role.Id != guildId).Select(role => role.Position).DefaultIfEmpty(int.MinValue).Max();

    private static DbSession? GetPublicSession(DbMember member) {
        var session = member.IdNavigation.Sessions
            .OrderByDescending(s => IsOnline(s))
            .ThenByDescending(s => s.LastSeen ?? s.CreatedAt)
            .FirstOrDefault();

        if (session?.Status == "unknown") session.Status = "online";
        return session;
    }

    private static bool IsOnline(DbSession? session) => session is { Status: not ("offline" or "invisible") };

    public static Presence BuildPresence(DbMember member) => BuildPresence(GetPublicSession(member), member.IdNavigation.ToPartialUser());

    private static Presence BuildMemberListPresence(DbMember member, DbSession? session) =>
        BuildPresence(session, new PartialUser { Id = member.Id });

    private static Presence BuildPresence(DbSession? session, PartialUser user) {
        var status = session?.Status == "invisible" ? "offline" : session?.Status ?? "offline";

        return new Presence {
            User = user,
            Activities = DeserializeActivities(session?.Activities),
            ClientStatus = DeserializeClientStatus(session?.ClientStatus),
            Status = status,
        };
    }

    public static ReplicationMessage<Presence> ToPresenceMessage(long userId, long guildId, Presence presence) => new() {
        Origin = OriginName,
        UserId = userId,
        GuildId = guildId,
        Event = "PRESENCE_UPDATE",
        CreatedAt = DateTime.Now,
        Payload = presence,
    };

    public static IReadOnlyList<ReplicationMessage<Presence>> BuildRequestedPresenceMessages(
        long userId,
        long guildId,
        IEnumerable<DbMember> visibleMembers,
        IEnumerable<long>? requestedMemberIds
    ) {
        if (requestedMemberIds is null) return [];

        var visibleMembersById = visibleMembers.ToDictionary(member => member.Id);
        return requestedMemberIds
            .Distinct()
            .Where(memberId => visibleMembersById.ContainsKey(memberId))
            .Select(memberId => ToPresenceMessage(userId, guildId, BuildPresence(visibleMembersById[memberId])))
            .ToList();
    }

    private static GuildMemberListSyncItem ToSyncItem(DbMember member, DbSession? session) {
        var publicMember = member.ToPublicMember();
        var presence = BuildMemberListPresence(member, session);

        return new GuildMemberListSyncItem {
            Member = new MemberWithPresence {
                User = publicMember.User,
                AvatarDecorationData = publicMember.AvatarDecorationData,
                Avatar = publicMember.Avatar,
                Banner = publicMember.Banner,
                Bio = publicMember.Bio,
                Collectibles = publicMember.Collectibles,
                DisplayNameStyles = publicMember.DisplayNameStyles,
                Nick = publicMember.Nick,
                Roles = publicMember.Roles?.Where(roleId => roleId != member.GuildId).ToList(),
                Presence = presence,
            },
        };
    }

    private static List<Activity> DeserializeActivities(string? activities) {
        if (string.IsNullOrWhiteSpace(activities)) return [];
        try {
            return JsonSerializer.Deserialize<List<Activity>>(activities) ?? [];
        }
        catch (JsonException) {
            return [];
        }
    }

    private static Presence.ClientStatuses DeserializeClientStatus(string? clientStatus) {
        if (string.IsNullOrWhiteSpace(clientStatus)) return new();
        try {
            return JsonSerializer.Deserialize<Presence.ClientStatuses>(clientStatus) ?? new();
        }
        catch (JsonException) {
            return new();
        }
    }

    private sealed record MemberListEntry(long DisplayRoleId, DbMember Member, DbSession? Session);
    private sealed record LazyMemberListSnapshot(IReadOnlyList<GuildMemberListSyncItem> Items, List<GuildMemberListGroupCount> Groups, int OnlineCount);
}
