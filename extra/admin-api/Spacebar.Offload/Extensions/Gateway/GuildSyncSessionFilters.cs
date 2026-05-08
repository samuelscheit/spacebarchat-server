using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Spacebar.Models.Db.Models;

namespace Spacebar.GatewayOffload.Extensions.Gateway;

public static class GuildSyncSessionFilters {
    // Keep EF Core filtered Include predicates in the built-in Contains(...) shape. Custom helper
    // methods such as IsOnline/CanPublishPresence are for already-materialized Session instances.
    public static IReadOnlyCollection<string> ExcludedPresenceStatuses => SessionPresenceProjection.NonPublicStatuses;

    public static bool CanPublishPresence(Session session, bool isLargeGuild, DateTime offlineThreshold) =>
        IsGuildSyncVisible(session, isLargeGuild, offlineThreshold);

    public static bool IsGuildSyncVisible(Session session, bool isLargeGuild, DateTime offlineThreshold) =>
        !session.IsAdminSession &&
        IsOnline(session) &&
        (!isLargeGuild || session.LastSeen >= offlineThreshold);

    public static Expression<Func<Session, bool>> IsGuildSyncVisibleExpression(bool isLargeGuild, DateTime offlineThreshold) =>
        session =>
            !session.IsAdminSession &&
            !ExcludedPresenceStatuses.Contains(session.Status) &&
            (!isLargeGuild || session.LastSeen >= offlineThreshold);

    public static bool IsOnline(Session session) => SessionPresenceProjection.IsPubliclyOnline(session);

    public static bool IsOnlineStatus(string status) => SessionPresenceProjection.IsPubliclyOnlineStatus(status);

    public static IQueryable<Member> ForGuildSync(
        this IQueryable<Member> members,
        long guildId,
        bool isLargeGuild,
        DateTime offlineThreshold
    ) {
        var isGuildSyncVisible = IsGuildSyncVisibleExpression(isLargeGuild, offlineThreshold);

        return members.Where(member => member.GuildId == guildId)
            .Include(member => member.IdNavigation)
            .ThenInclude(user => user.Sessions.AsQueryable().Where(isGuildSyncVisible))
            .Where(member => member.IdNavigation.Sessions.AsQueryable().Any(isGuildSyncVisible));
    }
}
