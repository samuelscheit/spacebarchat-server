using Microsoft.EntityFrameworkCore;
using Spacebar.GatewayOffload.Extensions.Gateway;
using Spacebar.Models.Db.Contexts;
using Spacebar.Models.Db.Models;

namespace Spacebar.Offload.Tests;

public class GuildSyncSessionFiltersTests {
    [Theory]
    [InlineData("online", true)]
    [InlineData("idle", true)]
    [InlineData("dnd", true)]
    [InlineData("offline", false)]
    [InlineData("invisible", false)]
    [InlineData("unknown", false)]
    public void IsOnlineMatchesGatewayPresenceStatuses(string status, bool expected) {
        var session = NewSession(status: status);

        Assert.Equal(expected, GuildSyncSessionFilters.IsOnline(session));
    }

    [Fact]
    public void CanPublishPresenceRejectsAdminSessions() {
        var threshold = new DateTime(2026, 5, 8, 0, 0, 0, DateTimeKind.Utc);
        var session = NewSession(isAdminSession: true, status: "online", lastSeen: threshold);

        Assert.False(GuildSyncSessionFilters.CanPublishPresence(session, isLargeGuild: false, threshold));
    }

    [Fact]
    public void CanPublishPresenceRejectsOldLargeGuildSessions() {
        var threshold = new DateTime(2026, 5, 8, 0, 0, 0, DateTimeKind.Utc);
        var session = NewSession(status: "online", lastSeen: threshold.AddTicks(-1));

        Assert.False(GuildSyncSessionFilters.CanPublishPresence(session, isLargeGuild: true, threshold));
    }

    [Fact]
    public void CanPublishPresenceAllowsSmallGuildSessionWithoutLastSeen() {
        var threshold = new DateTime(2026, 5, 8, 0, 0, 0, DateTimeKind.Utc);
        var session = NewSession(status: "online", lastSeen: null);

        Assert.True(GuildSyncSessionFilters.CanPublishPresence(session, isLargeGuild: false, threshold));
    }

    [Fact]
    public void GuildSyncFilteredIncludeUsingSharedStatusesCanGenerateSql() {
        var options = new DbContextOptionsBuilder<SpacebarDbContext>()
            .UseNpgsql("Host=localhost;Database=spacebar_test;Username=spacebar;Password=spacebar")
            .Options;
        using var db = new SpacebarDbContext(options);
        var isLargeGuild = true;
        var offlineThreshold = new DateTime(2026, 5, 8, 0, 0, 0, DateTimeKind.Utc);

        var sql = db.Members.AsNoTracking()
            .Where(member => member.GuildId == 123)
            .Include(member => member.IdNavigation)
            .ThenInclude(user => user.Sessions.Where(session =>
                !session.IsAdminSession &&
                !GuildSyncSessionFilters.ExcludedPresenceStatuses.Contains(session.Status) &&
                (!isLargeGuild || session.LastSeen >= offlineThreshold)))
            .Where(member => member.IdNavigation.Sessions.Count > 0)
            .ToQueryString();

        Assert.Contains("sessions", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("offline", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("invisible", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("unknown", sql, StringComparison.OrdinalIgnoreCase);
    }

    private static Session NewSession(string status = "online", bool isAdminSession = false, DateTime? lastSeen = null) =>
        new() {
            SessionId = Guid.NewGuid().ToString("N"),
            Activities = "[]",
            ClientInfo = "{}",
            ClientStatus = "{}",
            Status = status,
            IsAdminSession = isAdminSession,
            LastSeen = lastSeen,
        };
}
