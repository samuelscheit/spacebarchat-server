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
    public async IAsyncEnumerable<object> DoLazyRequest([FromBody] LazyRequest payload) {
        var user = await TraceResult.TraceAsync("getAuthUser", () => authService.GetCurrentUserAsync(Request));
        _ = await TraceResult.TraceAsync("getAuthSession", () => authService.GetCurrentSessionAsync(Request));
        var requestedChannels = payload.Channels ?? [];

        var members = await db.Members
            .AsNoTracking()
            .Where(m => m.GuildId == payload.GuildId)
            .Include(m => m.Roles)
            .Include(m => m.IdNavigation)
            .ThenInclude(u => u.Sessions.Where(s => !s.IsAdminSession))
            .ToListAsync();

        var requestingMember = members.FirstOrDefault(m => m.Id == user.Result.Id);
        if (requestingMember is null) {
            logger.LogWarning("User {user} requested lazy member list for guild {guildId}, but is not a member", user.Result.Id, payload.GuildId);
            yield break;
        }

        if (requestedChannels.Count == 0) {
            logger.LogWarning("User {user} requested lazy member list for guild {guildId}, but did not specify channels", user.Result.Id, payload.GuildId);
            yield break;
        }

        var sentRequestedPresences = false;

        foreach (var (channelIdValue, ranges) in requestedChannels) {
            if (!long.TryParse(channelIdValue, out var channelId)) {
                logger.LogWarning("User {user} requested lazy member list for guild {guildId} with invalid channel id {channelId}", user.Result.Id, payload.GuildId, channelIdValue);
                continue;
            }

            var channel = await db.Channels.AsNoTracking()
                .Include(c => c.Guild)
                .Include(c => c.Parent)
                .FirstOrDefaultAsync(c => c.Id == channelId && c.GuildId == payload.GuildId);
            if (channel is null) {
                logger.LogWarning("User {user} requested lazy member list for guild {guildId} channel {channelId}, but the channel was not found or cannot be represented", user.Result.Id, payload.GuildId, channelId);
                continue;
            }

            var guildOwnerId = channel.Guild?.OwnerId;
            var permissionChannel = LazyMemberListChannelAccess.GetPermissionChannel(channel);
            if (!LazyMemberListChannelAccess.CanViewChannel(requestingMember, permissionChannel, guildOwnerId)) {
                logger.LogWarning("User {user} requested lazy member list for guild {guildId} channel {channelId}, but lacks VIEW_CHANNEL", user.Result.Id, payload.GuildId, channelId);
                continue;
            }

            var visibleMembers = LazyMemberListChannelAccess.FilterVisibleMembers(members, permissionChannel, guildOwnerId);
            if (payload.IncludePresences && !sentRequestedPresences && payload.Members is { Count: > 0 }) {
                foreach (var presenceMessage in LazyMemberListProjection.BuildRequestedPresenceMessages(user.Result.Id, payload.GuildId, visibleMembers, payload.Members)) {
                    yield return presenceMessage;
                }

                sentRequestedPresences = true;
            }

            var listId = LazyMemberListChannelAccess.GetMemberListId(permissionChannel);
            var update = LazyMemberListProjection.BuildUpdate(payload.GuildId, listId, visibleMembers, ranges ?? [], payload.IncludePresences);
            yield return LazyMemberListProjection.ToMessage(user.Result.Id, update);
        }
    }
}
