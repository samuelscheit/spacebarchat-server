using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Spacebar.GatewayOffload;
using Spacebar.Interop.Authentication.AspNetCore;
using Spacebar.Interop.Replication.Abstractions;
using Spacebar.Models.Db.Contexts;
using Spacebar.Models.Gateway;
using Spacebar.Models.Generic;

namespace Spacebar.GatewayOffload.Controllers;

[ApiController]
[Route("/_spacebar/offload/gateway/LazyRequest")]
public class Op14Controller(ILogger<Op14Controller> logger, SpacebarAspNetAuthenticationService authService, SpacebarDbContext db) : ControllerBase {
    [HttpPost("")]
    public async IAsyncEnumerable<ReplicationMessage<GuildMemberListUpdate>> DoLazyRequest([FromBody] LazyRequest payload) {
        var user = await TraceResult.TraceAsync("getAuthUser", () => authService.GetCurrentUserAsync(Request));
        _ = await TraceResult.TraceAsync("getAuthSession", () => authService.GetCurrentSessionAsync(Request));

        if (!await db.Members.AsNoTracking().AnyAsync(m => m.GuildId == payload.GuildId && m.Id == user.Result.Id)) {
            logger.LogWarning("User {user} requested lazy member list for guild {guildId}, but is not a member", user.Result.Id, payload.GuildId);
            yield break;
        }

        if (payload.Channels.Count == 0) {
            logger.LogWarning("User {user} requested lazy member list for guild {guildId}, but did not specify channels", user.Result.Id, payload.GuildId);
            yield break;
        }

        var members = await db.Members
            .AsNoTracking()
            .Where(m => m.GuildId == payload.GuildId)
            .Include(m => m.Roles)
            .Include(m => m.IdNavigation)
            .ThenInclude(u => u.Sessions.Where(s => !s.IsAdminSession))
            .ToListAsync();

        foreach (var (channelIdValue, ranges) in payload.Channels) {
            if (!long.TryParse(channelIdValue, out var channelId)) {
                logger.LogWarning("User {user} requested lazy member list for guild {guildId} with invalid channel id {channelId}", user.Result.Id, payload.GuildId, channelIdValue);
                continue;
            }

            var listId = await GetMemberListIdAsync(db, payload.GuildId, channelId);
            if (listId is null) {
                logger.LogWarning("User {user} requested lazy member list for guild {guildId} channel {channelId}, but the channel was not found or cannot be represented", user.Result.Id, payload.GuildId, channelId);
                continue;
            }

            var update = LazyMemberListProjection.BuildUpdate(payload.GuildId, listId, members, ranges);
            yield return LazyMemberListProjection.ToMessage(user.Result.Id, update);
        }
    }

    private async Task<string?> GetMemberListIdAsync(SpacebarDbContext db, long guildId, long channelId) {
        var channel = await db.Channels.AsNoTracking().FirstOrDefaultAsync(c => c.Id == channelId && c.GuildId == guildId);
        if (channel == null) return null;

        if (string.IsNullOrWhiteSpace(channel.PermissionOverwrites) || channel.PermissionOverwrites == "[]") {
            return "everyone";
        }

        return null; // TODO
    }
}
