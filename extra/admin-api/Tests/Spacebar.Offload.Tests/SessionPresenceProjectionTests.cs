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
        var sessions = NewSessions();

        var expressionResults = sessions.Where(expressionPredicate).Select(session => session.SessionId).ToList();
        var inMemoryResults = sessions.Where(SessionPresenceProjection.IsPubliclyOnline).Select(session => session.SessionId).ToList();

        Assert.Equal(["online", "idle"], expressionResults);
        Assert.Equal(expressionResults, inMemoryResults);
    }

    [Fact]
    public void NonPublicStatusesCanBeUsedInsideQueryablePredicates() {
        var visibleSessionIds = NewSessions()
            .AsQueryable()
            .Where(session => !SessionPresenceProjection.NonPublicStatuses.Contains(session.Status))
            .Select(session => session.SessionId)
            .ToList();

        Assert.Equal(["online", "idle"], visibleSessionIds);
    }

    [Fact]
    public void NonPublicStatusesPredicateCanBeTranslatedByEfCore() {
        using var db = CreateDbContext();

        var sql = db.Sessions
            .Where(session => !SessionPresenceProjection.NonPublicStatuses.Contains(session.Status))
            .ToQueryString();

        Assert.Contains("sessions", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("status", sql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(nameof(SessionPresenceProjection.IsPubliclyOnline), sql, StringComparison.Ordinal);
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

    [Fact]
    public void NonPublicStatusesPredicateCanBeTranslatedInsideFilteredInclude() {
        using var db = CreateDbContext();
        var offlineThreshold = new DateTime(2026, 5, 8, 0, 0, 0, DateTimeKind.Unspecified);
        var isLargeGuild = true;

        var sql = db.Members
            .Include(member => member.IdNavigation)
            .ThenInclude(user => user.Sessions.Where(session =>
                !session.IsAdminSession &&
                !SessionPresenceProjection.NonPublicStatuses.Contains(session.Status) &&
                (!isLargeGuild || session.LastSeen >= offlineThreshold)))
            .ToQueryString();

        Assert.Contains("sessions", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("is_admin_session", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("status", sql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(nameof(SessionPresenceProjection.IsPubliclyOnline), sql, StringComparison.Ordinal);
    }

    [Fact]
    public void IsPubliclyOnlineUsesSameStatusesAsQueryablePredicate() {
        var sessions = NewSessions();

        var methodResult = sessions.Where(SessionPresenceProjection.IsPubliclyOnline).Select(session => session.SessionId);
        var queryableResult = sessions.AsQueryable()
            .Where(session => !SessionPresenceProjection.NonPublicStatuses.Contains(session.Status))
            .Select(session => session.SessionId);

        Assert.Equal(queryableResult, methodResult);
    }

    private static Session[] NewSessions() =>
        [
            new Session { SessionId = "online", Status = "online", Activities = "[]", ClientInfo = "{}", ClientStatus = "{}" },
            new Session { SessionId = "idle", Status = "idle", Activities = "[]", ClientInfo = "{}", ClientStatus = "{}" },
            new Session { SessionId = "offline", Status = "offline", Activities = "[]", ClientInfo = "{}", ClientStatus = "{}" },
            new Session { SessionId = "invisible", Status = "invisible", Activities = "[]", ClientInfo = "{}", ClientStatus = "{}" },
            new Session { SessionId = "unknown", Status = "unknown", Activities = "[]", ClientInfo = "{}", ClientStatus = "{}" },
        ];

    private static SpacebarDbContext CreateDbContext() {
        var options = new DbContextOptionsBuilder<SpacebarDbContext>()
            .UseNpgsql("Host=localhost;Database=spacebar;Username=spacebar;Password=spacebar")
            .Options;

        return new SpacebarDbContext(options);
    }
}
