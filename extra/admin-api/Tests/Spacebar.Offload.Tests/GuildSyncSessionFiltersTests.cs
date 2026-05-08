using Microsoft.EntityFrameworkCore;
using Spacebar.GatewayOffload.Extensions.Gateway;
using Spacebar.Models.Db.Contexts;
using Spacebar.Models.Db.Models;

namespace Spacebar.Offload.Tests;

public class GuildSyncSessionFiltersTests
{
    [Theory]
    [InlineData("online", true)]
    [InlineData("idle", true)]
    [InlineData("dnd", true)]
    [InlineData("offline", false)]
    [InlineData("invisible", false)]
    [InlineData("unknown", false)]
    public void IsOnlineStatusMatchesGuildSyncPresenceStatuses(string status, bool expected)
    {
        Assert.Equal(expected, GuildSyncSessionFilters.IsOnlineStatus(status));
    }

    [Fact]
    public void GuildSyncVisibleSessionPredicateMatchesRuntimeHelper()
    {
        var threshold = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc);
        var sessions = new[]
        {
            new Session { SessionId = "online", Status = "online", LastSeen = threshold },
            new Session { SessionId = "offline", Status = "offline", LastSeen = threshold },
            new Session { SessionId = "admin", Status = "online", IsAdminSession = true, LastSeen = threshold },
            new Session { SessionId = "stale", Status = "online", LastSeen = threshold.AddTicks(-1) },
            new Session { SessionId = "never-seen", Status = "online", LastSeen = null },
        };
        var visibleSessionIds = sessions
            .Where(s => GuildSyncSessionFilters.IsGuildSyncVisible(s, isLargeGuild: true, threshold))
            .Select(s => s.SessionId)
            .ToList();

        Assert.Equal(["online"], visibleSessionIds);
    }

    [Fact]
    public void GuildSyncVisibleSessionPredicateKeepsOlderSessionsForSmallGuilds()
    {
        var threshold = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc);
        var session = new Session { SessionId = "stale", Status = "online", LastSeen = threshold.AddDays(-30) };
        Assert.True(GuildSyncSessionFilters.IsGuildSyncVisible(session, isLargeGuild: false, threshold));
    }

    [Fact]
    public void ForGuildSyncLargeGuildQueryAppliesVisibleSessionPredicateToIncludeAndMemberFilter()
    {
        var sql = BuildGuildSyncSql(isLargeGuild: true);

        Assert.Contains("m.guild_id", sql);
        Assert.Contains("NOT (s0.is_admin_session)", sql);
        Assert.Contains("NOT (s.is_admin_session)", sql);
        Assert.Equal(2, CountOccurrences(sql, "status NOT IN ('offline', 'invisible', 'unknown')"));
        Assert.Equal(2, CountOccurrences(sql, "last_seen >="));
        Assert.DoesNotContain("WHERE u.id = s.user_id)", NormalizeSql(sql));
    }

    [Fact]
    public void ForGuildSyncSmallGuildQueryDoesNotApplyLastSeenThreshold()
    {
        var sql = BuildGuildSyncSql(isLargeGuild: false);

        Assert.Contains("m.guild_id", sql);
        Assert.Contains("NOT (s0.is_admin_session)", sql);
        Assert.Contains("NOT (s.is_admin_session)", sql);
        Assert.Equal(2, CountOccurrences(sql, "status NOT IN ('offline', 'invisible', 'unknown')"));
        Assert.DoesNotContain("last_seen >=", sql);
    }

    private static string BuildGuildSyncSql(bool isLargeGuild)
    {
        var threshold = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc);
        var options = new DbContextOptionsBuilder<SpacebarDbContext>()
            .UseNpgsql("Host=localhost;Database=spacebar_translation_test;Username=spacebar;Password=spacebar")
            .Options;

        using var db = new SpacebarDbContext(options);
        return db.Members
            .AsNoTracking()
            .ForGuildSync(123, isLargeGuild, threshold)
            .ToQueryString();
    }

    private static int CountOccurrences(string value, string substring)
    {
        var count = 0;
        var index = 0;
        while ((index = value.IndexOf(substring, index, StringComparison.Ordinal)) >= 0)
        {
            count++;
            index += substring.Length;
        }

        return count;
    }

    private static string NormalizeSql(string sql) =>
        string.Join(" ", sql.Split(null as char[], StringSplitOptions.RemoveEmptyEntries));
}
