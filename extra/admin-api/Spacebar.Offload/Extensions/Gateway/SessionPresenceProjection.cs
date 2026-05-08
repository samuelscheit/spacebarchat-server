using System.Linq.Expressions;
using Spacebar.Models.Db.Models;

namespace Spacebar.GatewayOffload.Extensions.Gateway;

public static class SessionPresenceProjection {
    private static readonly string[] NonPublicStatusValues = ["offline", "invisible", "unknown"];

    public static IReadOnlyCollection<string> NonPublicStatuses => NonPublicStatusValues;

    public static Expression<Func<Session, bool>> IsPubliclyOnlineExpression =>
        session => !NonPublicStatusValues.Contains(session.Status);

    public static bool IsPubliclyOnline(Session session) => IsPubliclyOnlineStatus(session.Status);

    public static bool IsPubliclyOnlineStatus(string status) =>
        !NonPublicStatuses.Contains(status);
}
