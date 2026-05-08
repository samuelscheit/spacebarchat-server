using Spacebar.Models.Db.Models;

namespace Spacebar.GatewayOffload.Extensions.Gateway;

public static class GuildSyncSessionFilters {
    private static readonly string[] NonPresenceStatuses = ["offline", "invisible", "unknown"];

    // Keep EF Core filtered Include predicates in the built-in Contains(...) shape. Custom helper
    // methods such as IsOnline/CanPublishPresence are for already-materialized Session instances.
    public static IReadOnlyCollection<string> ExcludedPresenceStatuses => NonPresenceStatuses;

    public static bool CanPublishPresence(Session session, bool isLargeGuild, DateTime offlineThreshold) =>
        !session.IsAdminSession &&
        IsOnline(session) &&
        (!isLargeGuild || session.LastSeen >= offlineThreshold);

    public static bool IsOnline(Session session) => !NonPresenceStatuses.Contains(session.Status);
}
