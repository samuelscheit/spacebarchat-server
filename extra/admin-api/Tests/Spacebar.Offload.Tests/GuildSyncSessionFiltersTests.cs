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
            Assert.False(GuildSyncSessionFilters.IsOnlineStatus(status));
        }
    }

    [Theory]
    [InlineData("online")]
    [InlineData("idle")]
    [InlineData("dnd")]
    public void IsOnlineAllowsGatewayPresenceStatuses(string status) {
        var session = NewSession(status: status);

        Assert.True(GuildSyncSessionFilters.IsOnline(session));
        Assert.True(GuildSyncSessionFilters.IsOnlineStatus(status));
    }

    [Fact]
    public void CanPublishPresenceRejectsAdminSessions() {
        var session = NewSession(isAdminSession: true, status: "online", lastSeen: OfflineThreshold);

        Assert.False(GuildSyncSessionFilters.CanPublishPresence(session, isLargeGuild: false, OfflineThreshold));
        Assert.False(GuildSyncSessionFilters.IsGuildSyncVisible(session, isLargeGuild: false, OfflineThreshold));
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
    public void GuildSyncVisibleSessionPredicateMatchesRuntimeHelper() {
        var sessions = new[] {
            NewSession(sessionId: "online", status: "online", lastSeen: OfflineThreshold),
            NewSession(sessionId: "offline", status: "offline", lastSeen: OfflineThreshold),
            NewSession(sessionId: "admin", status: "online", isAdminSession: true, lastSeen: OfflineThreshold),
            NewSession(sessionId: "stale", status: "online", lastSeen: OfflineThreshold.AddTicks(-1)),
            NewSession(sessionId: "never-seen", status: "online", lastSeen: null),
        };
        var expressionPredicate = GuildSyncSessionFilters.IsGuildSyncVisibleExpression(isLargeGuild: true, OfflineThreshold).Compile();

        var helperResults = sessions
            .Where(session => GuildSyncSessionFilters.IsGuildSyncVisible(session, isLargeGuild: true, OfflineThreshold))
            .Select(session => session.SessionId)
            .ToList();
        var expressionResults = sessions.Where(expressionPredicate).Select(session => session.SessionId).ToList();

        Assert.Equal(["online"], helperResults);
        Assert.Equal(helperResults, expressionResults);
    }

    [Fact]
    public void ForGuildSyncLargeGuildQueryAppliesVisibleSessionPredicateToIncludeAndMemberFilter() {
        var sql = BuildGuildSyncSql(isLargeGuild: true);

        Assert.Contains("m.guild_id", sql);
        Assert.Contains("is_admin_session", sql);
        Assert.Contains("status", sql);
        Assert.Contains("last_seen", sql);
        foreach (var status in GuildSyncSessionFilters.ExcludedPresenceStatuses) {
            Assert.Contains(status, sql, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public void ForGuildSyncSmallGuildQueryDoesNotApplyLastSeenThreshold() {
        var sql = BuildGuildSyncSql(isLargeGuild: false);

        Assert.Contains("m.guild_id", sql);
        Assert.Contains("is_admin_session", sql);
        Assert.Contains("status", sql);
        Assert.DoesNotContain("last_seen >=", sql, StringComparison.OrdinalIgnoreCase);
        foreach (var status in GuildSyncSessionFilters.ExcludedPresenceStatuses) {
            Assert.Contains(status, sql, StringComparison.OrdinalIgnoreCase);
        }
    }

    private static string BuildGuildSyncSql(bool isLargeGuild) {
        var options = new DbContextOptionsBuilder<SpacebarDbContext>()
            .UseNpgsql("Host=localhost;Database=spacebar_translation_test;Username=spacebar;Password=spacebar")
            .Options;

        using var db = new SpacebarDbContext(options);
        return db.Members
            .AsNoTracking()
            .ForGuildSync(123, isLargeGuild, OfflineThreshold)
            .ToQueryString();
    }

    private static Session NewSession(string status = "online", bool isAdminSession = false, DateTime? lastSeen = null, string? sessionId = null) =>
        new() {
            SessionId = sessionId ?? Guid.NewGuid().ToString("N"),
            Activities = "[]",
            ClientInfo = "{}",
            ClientStatus = "{}",
            Status = status,
            IsAdminSession = isAdminSession,
            LastSeen = lastSeen,
        };
}
