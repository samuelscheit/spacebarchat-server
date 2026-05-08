using Spacebar.Models.Db.Models;

namespace Spacebar.GatewayOffload.Extensions.Gateway;

public static class GuildSyncSessionFilters {
    private static readonly string[] NonPresenceStatuses = ["offline", "invisible", "unknown"];

    public static IReadOnlyCollection<string> ExcludedPresenceStatuses => NonPresenceStatuses;

    public static bool CanPublishPresence(Session session, bool isLargeGuild, DateTime offlineThreshold) =>
        !session.IsAdminSession &&
        IsOnline(session) &&
        (!isLargeGuild || session.LastSeen >= offlineThreshold);

    public static bool IsOnline(Session session) => !NonPresenceStatuses.Contains(session.Status);
}
