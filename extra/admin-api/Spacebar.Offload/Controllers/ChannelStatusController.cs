using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Spacebar.GatewayOffload.Extensions.Gateway;
using Spacebar.Interop.Authentication.AspNetCore;
using Spacebar.Interop.Replication.Abstractions;
using Spacebar.Models.Db.Contexts;
using Spacebar.Models.Gateway;

namespace Spacebar.GatewayOffload.Controllers;

[ApiController]
[Route("/_spacebar/offload/gateway")]
public class ChannelStatusController(SpacebarAspNetAuthenticationService authService, SpacebarDbContext db) : ControllerBase {
    [HttpPost("ChannelStatuses")]
    public async IAsyncEnumerable<ReplicationMessage<ChannelStatusesResponse>> GetChannelStatuses([FromBody] ChannelStatusesRequest req) {
        _ = await authService.GetCurrentUserAsync(Request);

        foreach (var guildId in req.GuildIds ?? [req.GuildId!.Value]) {
            var channels = await ChannelInfoProjection
                .SelectPersistedChannelStatuses(db.Channels.AsNoTracking(), guildId)
                .ToListAsync();

            yield return ChannelInfoProjection.ToChannelStatusesMessage(guildId, channels);
        }
    }

    [HttpPost("ChannelInfo")]
    public async IAsyncEnumerable<ReplicationMessage<ChannelInfoResponse>> GetChannelInfos([FromBody] ChannelInfoRequest req) {
        _ = await authService.GetCurrentUserAsync(Request);
        var fields = req.Fields.ToHashSet(StringComparer.Ordinal);

        foreach (var guildId in req.GuildIds ?? [req.GuildId!.Value]) {
            var channels = await ChannelInfoProjection
                .SelectActiveVoiceChannelInfos(db.Channels.AsNoTracking(), guildId)
                .ToListAsync();

            yield return ChannelInfoProjection.ToChannelInfoMessage(guildId, channels, fields);
        }
    }
}
