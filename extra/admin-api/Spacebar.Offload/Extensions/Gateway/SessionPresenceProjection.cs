using System.Linq.Expressions;
using Spacebar.Models.Db.Models;

namespace Spacebar.GatewayOffload.Extensions.Gateway;

public static class SessionPresenceProjection {
    public static readonly string[] NonPublicStatuses = ["offline", "invisible", "unknown"];

    public static Expression<Func<Session, bool>> IsPubliclyOnlineExpression =>
        session => !NonPublicStatuses.Contains(session.Status);

    public static bool IsPubliclyOnline(Session session) => IsPubliclyOnlineStatus(session.Status);

    public static bool IsPubliclyOnlineStatus(string status) =>
        !NonPublicStatuses.Contains(status);
}
