using Spacebar.Models.Db.Models;

namespace Spacebar.GatewayOffload.Extensions.Gateway;

public static class SessionPresenceProjection
{
    public static readonly string[] NonVisibleStatuses = ["offline", "invisible", "unknown"];

    public static bool IsVisiblePresence(Session session) => IsVisiblePresenceStatus(session.Status);

    public static bool IsVisiblePresenceStatus(string status) => !NonVisibleStatuses.Contains(status);
}
