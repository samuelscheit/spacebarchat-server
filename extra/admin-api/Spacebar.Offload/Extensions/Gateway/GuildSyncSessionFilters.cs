using Spacebar.Models.Db.Models;

namespace Spacebar.GatewayOffload.Extensions.Gateway;

public static class GuildSyncSessionFilters {
    // Keep EF Core filtered Include predicates in the built-in Contains(...) shape. Custom helper
    // methods such as IsOnline/CanPublishPresence are for already-materialized Session instances.
    public static IReadOnlyCollection<string> ExcludedPresenceStatuses => SessionPresenceProjection.NonPublicStatuses;

    public static bool CanPublishPresence(Session session, bool isLargeGuild, DateTime offlineThreshold) =>
        !session.IsAdminSession &&
        IsOnline(session) &&
        (!isLargeGuild || session.LastSeen >= offlineThreshold);

    public static bool IsOnline(Session session) => SessionPresenceProjection.IsPubliclyOnline(session);
}
