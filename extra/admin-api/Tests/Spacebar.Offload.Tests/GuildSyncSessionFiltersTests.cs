using Microsoft.EntityFrameworkCore;
using Spacebar.GatewayOffload.Extensions.Gateway;
using Spacebar.Models.Db.Contexts;
using Spacebar.Models.Db.Models;

namespace Spacebar.Offload.Tests;

public class GuildSyncSessionFiltersTests {
    private static readonly DateTime OfflineThreshold = new(2026, 5, 8, 0, 0, 0);

    [Fact]
    public void IsOnlineRejectsEveryExcludedPresenceStatus() {
        foreach (var status in GuildSyncSessionFilters.ExcludedPresenceStatuses) {
            Assert.False(GuildSyncSessionFilters.IsOnline(NewSession(status: status)));
        }
    }

    [Theory]
    [InlineData("online")]
    [InlineData("idle")]
    [InlineData("dnd")]
    public void IsOnlineAllowsGatewayPresenceStatuses(string status) {
        var session = NewSession(status: status);

        Assert.True(GuildSyncSessionFilters.IsOnline(session));
    }

    [Fact]
    public void CanPublishPresenceRejectsAdminSessions() {
        var session = NewSession(isAdminSession: true, status: "online", lastSeen: OfflineThreshold);

        Assert.False(GuildSyncSessionFilters.CanPublishPresence(session, isLargeGuild: false, OfflineThreshold));
    }

    [Fact]
    public void CanPublishPresenceRejectsExcludedStatuses() {
        foreach (var status in GuildSyncSessionFilters.ExcludedPresenceStatuses) {
            var session = NewSession(status: status, lastSeen: OfflineThreshold);

            Assert.False(GuildSyncSessionFilters.CanPublishPresence(session, isLargeGuild: false, OfflineThreshold));
        }
    }

    [Fact]
    public void CanPublishPresenceRejectsLargeGuildSessionsWithoutLastSeen() {
        var session = NewSession(status: "online", lastSeen: null);

        Assert.False(GuildSyncSessionFilters.CanPublishPresence(session, isLargeGuild: true, OfflineThreshold));
    }

    [Fact]
    public void CanPublishPresenceRejectsOldLargeGuildSessions() {
        var session = NewSession(status: "online", lastSeen: OfflineThreshold.AddTicks(-1));

        Assert.False(GuildSyncSessionFilters.CanPublishPresence(session, isLargeGuild: true, OfflineThreshold));
    }

    [Fact]
    public void CanPublishPresenceAllowsLargeGuildSessionSeenAtThreshold() {
        var session = NewSession(status: "online", lastSeen: OfflineThreshold);

        Assert.True(GuildSyncSessionFilters.CanPublishPresence(session, isLargeGuild: true, OfflineThreshold));
    }

    [Fact]
    public void CanPublishPresenceAllowsSmallGuildSessionWithoutLastSeen() {
        var session = NewSession(status: "online", lastSeen: null);

        Assert.True(GuildSyncSessionFilters.CanPublishPresence(session, isLargeGuild: false, OfflineThreshold));
    }

    [Fact]
    public void GuildSyncFilteredIncludeUsingSharedStatusesCanGenerateSql() {
        var options = new DbContextOptionsBuilder<SpacebarDbContext>()
            .UseNpgsql("Host=localhost;Database=spacebar_test;Username=spacebar;Password=spacebar")
            .Options;
        using var db = new SpacebarDbContext(options);
        var isLargeGuild = true;

        var sql = db.Members.AsNoTracking()
            .Where(member => member.GuildId == 123)
            .Include(member => member.IdNavigation)
            .ThenInclude(user => user.Sessions.Where(session =>
                !session.IsAdminSession &&
                !GuildSyncSessionFilters.ExcludedPresenceStatuses.Contains(session.Status) &&
                (!isLargeGuild || session.LastSeen >= OfflineThreshold)))
            .Where(member => member.IdNavigation.Sessions.Count > 0)
            .ToQueryString();

        Assert.Contains("sessions", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("is_admin_session", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("last_seen", sql, StringComparison.OrdinalIgnoreCase);
        foreach (var status in GuildSyncSessionFilters.ExcludedPresenceStatuses) {
            Assert.Contains(status, sql, StringComparison.OrdinalIgnoreCase);
        }
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
