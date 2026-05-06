using Spacebar.Interop.Replication.Abstractions;
using Spacebar.Models.Db.Models;
using Spacebar.Models.Gateway;

namespace Spacebar.GatewayOffload.Extensions.Gateway;

public readonly record struct VoiceChannelState(long ChannelId, string? Status);

public static class ChannelInfoProjection {
    public const string ChannelInfoEvent = "CHANNEL_INFO";
    public const string ChannelStatusesEvent = "CHANNEL_STATUSES";

    public static IQueryable<VoiceChannelState> SelectActiveVoiceChannelInfos(IQueryable<Channel> channels, long guildId) =>
        channels
            .Where(channel => channel.Type == 2 && channel.GuildId == guildId && channel.VoiceStates.Any())
            .Select(channel => new VoiceChannelState(channel.Id, channel.Status));

    public static IQueryable<VoiceChannelState> SelectPersistedChannelStatuses(IQueryable<Channel> channels, long guildId) =>
        channels
            .Where(channel => channel.Type == 2 && channel.GuildId == guildId && channel.Status != null && channel.Status != "")
            .Select(channel => new VoiceChannelState(channel.Id, channel.Status));

    public static ReplicationMessage<ChannelInfoResponse> ToChannelInfoMessage(long guildId, IEnumerable<VoiceChannelState> channels, IReadOnlySet<string> fields) =>
        new() {
            Event = ChannelInfoEvent,
            Payload = new() {
                GuildId = guildId,
                Channels = channels
                    .Select(channel => ToChannelInfo(channel, fields))
                    .ToList(),
            },
        };

    public static ReplicationMessage<ChannelStatusesResponse> ToChannelStatusesMessage(long guildId, IEnumerable<VoiceChannelState> channels) =>
        new() {
            Event = ChannelStatusesEvent,
            Payload = new() {
                GuildId = guildId,
                Channels = channels
                    .Select(ToChannelStatus)
                    .OfType<ChannelStatus>()
                    .ToList(),
            },
        };

    public static ChannelInfo ToChannelInfo(VoiceChannelState channel, IReadOnlySet<string> fields) {
        var includeStatus = fields.Contains("status");
        var includeVoiceStartTime = fields.Contains("voice_start_time");

        return new() {
            ChannelId = channel.ChannelId,
            Status = includeStatus ? NormalizeStatus(channel.Status) : null,
            IncludeStatus = includeStatus,
            VoiceStartTime = null,
            IncludeVoiceStartTime = includeVoiceStartTime,
        };
    }

    public static ChannelStatus? ToChannelStatus(VoiceChannelState channel) {
        var status = NormalizeStatus(channel.Status);
        return status is null
            ? null
            : new() {
                ChannelId = channel.ChannelId,
                Status = status,
            };
    }

    private static string? NormalizeStatus(string? status) => status == "" ? null : status;
}
