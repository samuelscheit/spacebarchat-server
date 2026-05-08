using Microsoft.EntityFrameworkCore;
using Spacebar.GatewayOffload.Extensions.Gateway;
using Spacebar.Models.Db.Contexts;
using Spacebar.Models.Db.Models;

namespace Spacebar.Offload.Tests;

public class SessionPresenceProjectionTests {
    [Theory]
    [InlineData("online", true)]
    [InlineData("idle", true)]
    [InlineData("dnd", true)]
    [InlineData("offline", false)]
    [InlineData("invisible", false)]
    [InlineData("unknown", false)]
    public void IsPubliclyOnlineMatchesGatewaySyncVisibility(string status, bool expected) {
        var session = new Session { Status = status };

        Assert.Equal(expected, SessionPresenceProjection.IsPubliclyOnline(session));
        Assert.Equal(expected, SessionPresenceProjection.IsPubliclyOnlineStatus(status));
    }

    [Fact]
    public void IsPubliclyOnlineExpressionMatchesInMemoryPredicate() {
        var expressionPredicate = SessionPresenceProjection.IsPubliclyOnlineExpression.Compile();
        var sessions = new[] {
            new Session { SessionId = "online", Status = "online" },
            new Session { SessionId = "idle", Status = "idle" },
            new Session { SessionId = "offline", Status = "offline" },
            new Session { SessionId = "invisible", Status = "invisible" },
            new Session { SessionId = "unknown", Status = "unknown" },
        };

        var expressionResults = sessions.Where(expressionPredicate).Select(session => session.SessionId).ToList();
        var inMemoryResults = sessions.Where(SessionPresenceProjection.IsPubliclyOnline).Select(session => session.SessionId).ToList();

        Assert.Equal(["online", "idle"], expressionResults);
        Assert.Equal(expressionResults, inMemoryResults);
    }

    [Fact]
    public void IsPubliclyOnlineExpressionTranslatesInsideFilteredInclude() {
        using var db = CreateDbContext();
        var offlineThreshold = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var sql = db.Members
            .Include(member => member.IdNavigation)
            .ThenInclude(user => user.Sessions.AsQueryable()
                .Where(SessionPresenceProjection.IsPubliclyOnlineExpression)
                .Where(session => !session.IsAdminSession && session.LastSeen >= offlineThreshold))
            .ToQueryString();

        Assert.Contains("sessions", sql);
        Assert.Contains("is_admin_session", sql);
        Assert.Contains("status", sql);
        Assert.Contains("offline", sql);
        Assert.Contains("invisible", sql);
        Assert.Contains("unknown", sql);
    }

    private static SpacebarDbContext CreateDbContext() {
        var options = new DbContextOptionsBuilder<SpacebarDbContext>()
            .UseNpgsql("Host=localhost;Database=spacebar;Username=spacebar;Password=spacebar")
            .Options;

        return new SpacebarDbContext(options);
    }
}
