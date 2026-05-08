using System.Collections.Frozen;
using System.Text.Json;
using ArcaneLibs.Extensions;
using Spacebar.GatewayOffload.Extensions.Gateway;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Spacebar.DataMappings.Generic;
using Spacebar.Interop.Authentication.AspNetCore;
using Spacebar.Interop.Replication.Abstractions;
using Spacebar.Models.Db.Contexts;
using Spacebar.Models.Db.Models;
using Spacebar.Models.Gateway;
using Spacebar.Models.Generic;

namespace Spacebar.GatewayOffload.Controllers;

[ApiController]
[Route("/_spacebar/offload/gateway/GuildMembers")]
public class Op8Controller(ILogger<Op8Controller> logger, SpacebarAspNetAuthenticationService authService, SpacebarDbContext db, IServiceProvider sp) : ControllerBase
{
    [HttpPost("")]
    public async IAsyncEnumerable<ReplicationMessage<GuildSyncResponse>> DoGuildSync(List<long> guildIds)
    {
        var user = await authService.GetCurrentUserAsync(Request);
        guildIds = (await db.Members.AsNoTracking().Where(x => x.Id == user.Id).Select(x => x.GuildId).ToListAsync())
            .Intersect(guildIds)
            .OrderByDescending(gi => db.Members.Count(m => m.GuildId == gi))
            .ToList();

        var syncs = guildIds.Select(GetGuildSyncAsync).ToList().ToAsyncResultEnumerable();
        await foreach (var res in syncs)
        {
            yield return new()
            {
                Origin = "OFFLOAD_GUILD_SYNC",
                UserId = user.Id,
                Event = "GUILD_SYNC",
                CreatedAt = DateTime.Now,
                Payload = res
            };
        }
    }

    private async Task<GuildSyncResponse> GetGuildSyncAsync(long guildId)
    {
        await using var sc = sp.CreateAsyncScope();
        var _db = sc.ServiceProvider.GetRequiredService<SpacebarDbContext>();
        var memberCount = await _db.Members.AsNoTracking().Where(x => x.GuildId == guildId).CountAsync();

        var offlineTreshold = DateTime.Now.Subtract(TimeSpan.FromDays(14));
        var isLargeGuild = memberCount > 10000;

        var members = await _db.Members.AsNoTracking().Where(x => x.GuildId == guildId)
            .Include(x => x.IdNavigation)
            .ThenInclude(x => x.Sessions.AsQueryable()
                .Where(SessionPresenceProjection.IsPubliclyOnlineExpression)
                .Where(s => !s.IsAdminSession && (!isLargeGuild || s.LastSeen >= offlineTreshold)))
            .Where(x => x.IdNavigation.Sessions.Count > 0) // ignore members without sessions
            .ToListAsync();

        var mappedPartialUsers = members.Select(x => x.IdNavigation).ToFrozenDictionary(x => x.Id, x => x.ToPartialUser());
        var mappedMembers = members.ToFrozenDictionary(m => m.Id, m => m.ToPublicMember(mappedPartialUsers[m.Id]));

        var presences = members.Select(x => x.IdNavigation).Where(x => x.Sessions.Count > 0).ToFrozenDictionary(x => x.Id, x =>
        {
            var sortedSessions = x.Sessions.OrderByDescending(s => s.LastSeen).ToList();
            return new Presence()
            {
                GuildId = guildId,
                User = mappedPartialUsers[x.Id],
                Activities = x.Sessions.Where(SessionPresenceProjection.IsPubliclyOnline)
                    .SelectMany(s => JsonSerializer.Deserialize<Activity[]>(s.Activities) ?? []).ToList(),
                Status = sortedSessions.FirstOrDefault(s => !string.IsNullOrWhiteSpace(s.Status))?.Status ?? "offline",
                ClientStatus = JsonSerializer.Deserialize<Presence.ClientStatuses>(sortedSessions.First(s => !string.IsNullOrWhiteSpace(s.ClientStatus)).ClientStatus) ??
                               new()
            };
        }).ToFrozenDictionary();

        var r = new GuildSyncResponse()
        {
            GuildId = guildId,
            Members = mappedMembers.Values.ToList(),
            Presences = presences.Values.ToList()
        };
        return r;
    }
}
