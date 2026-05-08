using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Spacebar.Models.Db.Models;

namespace Spacebar.GatewayOffload.Extensions.Gateway;

public static class GuildSyncSessionFilters
{
    private static readonly string[] OfflineStatuses = ["offline", "invisible", "unknown"];

    public static bool IsOnlineStatus(string status) => !OfflineStatuses.Contains(status);

    public static bool IsOnline(Session session) => IsOnlineStatus(session.Status);

    public static bool IsGuildSyncVisible(Session session, bool isLargeGuild, DateTime offlineThreshold) =>
        IsGuildSyncVisibleExpression(isLargeGuild, offlineThreshold).Compile()(session);

    public static Expression<Func<Session, bool>> IsGuildSyncVisibleExpression(bool isLargeGuild, DateTime offlineThreshold) =>
        session =>
            !session.IsAdminSession
            && !OfflineStatuses.Contains(session.Status)
            && (!isLargeGuild || session.LastSeen >= offlineThreshold);

    public static IQueryable<Member> ForGuildSync(
        this IQueryable<Member> members,
        long guildId,
        bool isLargeGuild,
        DateTime offlineThreshold)
    {
        var isGuildSyncVisible = IsGuildSyncVisibleExpression(isLargeGuild, offlineThreshold);

        return members.Where(x => x.GuildId == guildId)
            .Include(x => x.IdNavigation)
            .ThenInclude(x => x.Sessions.AsQueryable().Where(isGuildSyncVisible))
            .Where(x => x.IdNavigation.Sessions.AsQueryable().Any(isGuildSyncVisible));
    }
}
