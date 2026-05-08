using Microsoft.EntityFrameworkCore;
using Spacebar.Models.Db.Models;

namespace Spacebar.GatewayOffload.Extensions.Gateway;

public static class GuildSyncSessionFilters
{
    private static readonly string[] OfflineStatuses = ["offline", "invisible", "unknown"];

    public static bool IsOnlineStatus(string status) => !OfflineStatuses.Contains(status);

    public static bool IsOnline(Session session) => IsOnlineStatus(session.Status);

    public static bool IsGuildSyncVisible(Session session, bool isLargeGuild, DateTime offlineThreshold) =>
        !session.IsAdminSession && IsOnline(session) && (!isLargeGuild || session.LastSeen >= offlineThreshold);

    public static IQueryable<Member> ForGuildSync(
        this IQueryable<Member> members,
        long guildId,
        bool isLargeGuild,
        DateTime offlineThreshold) =>
        members.Where(x => x.GuildId == guildId)
            .Include(x => x.IdNavigation)
            .ThenInclude(x => x.Sessions.Where(s =>
                !s.IsAdminSession
                && !OfflineStatuses.Contains(s.Status)
                && (!isLargeGuild || s.LastSeen >= offlineThreshold)))
            .Where(x => x.IdNavigation.Sessions.Count > 0);
}
