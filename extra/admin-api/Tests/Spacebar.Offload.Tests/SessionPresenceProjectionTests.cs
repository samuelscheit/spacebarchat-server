using Microsoft.EntityFrameworkCore;
using Spacebar.GatewayOffload.Extensions.Gateway;
using Spacebar.Models.Db.Contexts;
using Spacebar.Models.Db.Models;

namespace Spacebar.Offload.Tests;

public class SessionPresenceProjectionTests
{
    [Theory]
    [InlineData("online", true)]
    [InlineData("idle", true)]
    [InlineData("dnd", true)]
    [InlineData("offline", false)]
    [InlineData("invisible", false)]
    [InlineData("unknown", false)]
    public void IsVisiblePresenceStatusMatchesGatewayVisibility(string status, bool expected)
    {
        Assert.Equal(expected, SessionPresenceProjection.IsVisiblePresenceStatus(status));
    }

    [Fact]
    public void NonVisibleStatusesCanBeUsedInsideQueryablePredicates()
    {
        var sessions = new[]
        {
            new Session { SessionId = "online", Status = "online", Activities = "[]", ClientInfo = "{}", ClientStatus = "{}" },
            new Session { SessionId = "offline", Status = "offline", Activities = "[]", ClientInfo = "{}", ClientStatus = "{}" },
            new Session { SessionId = "invisible", Status = "invisible", Activities = "[]", ClientInfo = "{}", ClientStatus = "{}" },
            new Session { SessionId = "unknown", Status = "unknown", Activities = "[]", ClientInfo = "{}", ClientStatus = "{}" },
            new Session { SessionId = "idle", Status = "idle", Activities = "[]", ClientInfo = "{}", ClientStatus = "{}" },
        }.AsQueryable();

        var visibleSessionIds = sessions
            .Where(session => !SessionPresenceProjection.NonVisibleStatuses.Contains(session.Status))
            .Select(session => session.SessionId)
            .ToList();

        Assert.Equal(["online", "idle"], visibleSessionIds);
    }

    [Fact]
    public void NonVisibleStatusesPredicateCanBeTranslatedByEfCore()
    {
        using var db = CreateDbContext();

        var sql = db.Sessions
            .Where(session => !SessionPresenceProjection.NonVisibleStatuses.Contains(session.Status))
            .ToQueryString();

        Assert.Contains("sessions", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("status", sql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(nameof(SessionPresenceProjection.IsVisiblePresence), sql, StringComparison.Ordinal);
    }

    [Fact]
    public void NonVisibleStatusesPredicateCanBeTranslatedInsideFilteredInclude()
    {
        using var db = CreateDbContext();
        var offlineThreshold = new DateTime(2026, 5, 8, 0, 0, 0, DateTimeKind.Unspecified);
        var isLargeGuild = true;

        var sql = db.Members
            .Include(member => member.IdNavigation)
            .ThenInclude(user => user.Sessions.Where(session =>
                !session.IsAdminSession &&
                !SessionPresenceProjection.NonVisibleStatuses.Contains(session.Status) &&
                (!isLargeGuild || session.LastSeen >= offlineThreshold)))
            .ToQueryString();

        Assert.Contains("sessions", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("is_admin_session", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("status", sql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(nameof(SessionPresenceProjection.IsVisiblePresence), sql, StringComparison.Ordinal);
    }

    [Fact]
    public void IsVisiblePresenceUsesSameStatusesAsQueryablePredicate()
    {
        var sessions = new[]
        {
            new Session { SessionId = "online", Status = "online", Activities = "[]", ClientInfo = "{}", ClientStatus = "{}" },
            new Session { SessionId = "offline", Status = "offline", Activities = "[]", ClientInfo = "{}", ClientStatus = "{}" },
            new Session { SessionId = "invisible", Status = "invisible", Activities = "[]", ClientInfo = "{}", ClientStatus = "{}" },
            new Session { SessionId = "unknown", Status = "unknown", Activities = "[]", ClientInfo = "{}", ClientStatus = "{}" },
            new Session { SessionId = "dnd", Status = "dnd", Activities = "[]", ClientInfo = "{}", ClientStatus = "{}" },
        };

        var methodResult = sessions.Where(SessionPresenceProjection.IsVisiblePresence).Select(session => session.SessionId);
        var queryableResult = sessions.AsQueryable()
            .Where(session => !SessionPresenceProjection.NonVisibleStatuses.Contains(session.Status))
            .Select(session => session.SessionId);

        Assert.Equal(queryableResult, methodResult);
    }

    private static SpacebarDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<SpacebarDbContext>()
            .UseNpgsql("Host=localhost;Database=spacebar;Username=spacebar;Password=spacebar")
            .Options;

        return new SpacebarDbContext(options);
    }
}
