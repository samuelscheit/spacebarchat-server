using System.Text.Json;
using System.Text.Json.Serialization;
using Spacebar.GatewayOffload.Extensions.Gateway;
using Spacebar.Models.Gateway;
using DbChannel = Spacebar.Models.Db.Models.Channel;
using DbChannelType = Spacebar.Models.Db.Models.ChannelType;
using DbVoiceState = Spacebar.Models.Db.Models.VoiceState;

namespace Spacebar.Offload.Tests;

public class ChannelInfoProjectionTests {
    private static readonly JsonSerializerOptions OffloadJsonOptions = new() {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    [Fact]
    public void SelectPersistedChannelStatusesIncludesStatusWithoutVoiceStates() {
        var channels = new[] {
            new DbChannel { Id = 1, Type = DbChannelType.GuildVoice, GuildId = 10, Status = "Planning" },
            new DbChannel { Id = 2, Type = DbChannelType.GuildVoice, GuildId = 10, Status = null },
            new DbChannel { Id = 3, Type = DbChannelType.GuildVoice, GuildId = 10, Status = "" },
            new DbChannel { Id = 4, Type = DbChannelType.GuildText, GuildId = 10, Status = "Text" },
            new DbChannel { Id = 5, Type = DbChannelType.GuildVoice, GuildId = 11, Status = "Other guild" },
        }.AsQueryable();

        var statuses = ChannelInfoProjection.SelectPersistedChannelStatuses(channels, 10).ToList();

        var status = Assert.Single(statuses);
        Assert.Equal(1, status.ChannelId);
        Assert.Equal("Planning", status.Status);
    }

    [Fact]
    public void SelectActiveVoiceChannelInfosRequiresVoiceStates() {
        var channels = new[] {
            new DbChannel { Id = 1, Type = DbChannelType.GuildVoice, GuildId = 10, Status = "Planning" },
            new DbChannel { Id = 2, Type = DbChannelType.GuildVoice, GuildId = 10, Status = "Active", VoiceStates = { new DbVoiceState { Id = 20 } } },
            new DbChannel { Id = 3, Type = DbChannelType.GuildText, GuildId = 10, Status = "Text", VoiceStates = { new DbVoiceState { Id = 30 } } },
            new DbChannel { Id = 4, Type = DbChannelType.GuildVoice, GuildId = 11, Status = "Other guild", VoiceStates = { new DbVoiceState { Id = 40 } } },
        }.AsQueryable();

        var infos = ChannelInfoProjection.SelectActiveVoiceChannelInfos(channels, 10).ToList();

        var info = Assert.Single(infos);
        Assert.Equal(2, info.ChannelId);
        Assert.Equal("Active", info.Status);
    }

    [Fact]
    public void ToChannelInfoUsesPersistedStatusWhenRequested() {
        var channel = new VoiceChannelState(123, "Planning");
        var fields = new HashSet<string>(StringComparer.Ordinal) {
            "status",
            "voice_start_time",
        };

        var info = ChannelInfoProjection.ToChannelInfo(channel, fields);

        Assert.Equal(123, info.ChannelId);
        Assert.Equal("Planning", info.Status);
        Assert.True(info.IncludeStatus);
        Assert.Null(info.VoiceStartTime);
        Assert.True(info.IncludeVoiceStartTime);
    }

    [Fact]
    public void ToChannelInfoOmitsStatusWhenNotRequested() {
        var channel = new VoiceChannelState(123, "Planning");
        var fields = new HashSet<string>(StringComparer.Ordinal);

        var info = ChannelInfoProjection.ToChannelInfo(channel, fields);

        Assert.Equal(123, info.ChannelId);
        Assert.Null(info.Status);
        Assert.False(info.IncludeStatus);
        Assert.Null(info.VoiceStartTime);
        Assert.False(info.IncludeVoiceStartTime);
    }

    [Fact]
    public void ToChannelStatusSkipsChannelsWithoutPersistedStatus() {
        Assert.Null(ChannelInfoProjection.ToChannelStatus(new VoiceChannelState(123, null)));
        Assert.Null(ChannelInfoProjection.ToChannelStatus(new VoiceChannelState(123, "")));
    }

    [Fact]
    public void ToChannelStatusKeepsPersistedStatus() {
        var status = ChannelInfoProjection.ToChannelStatus(new VoiceChannelState(123, "Planning"));

        Assert.NotNull(status);
        Assert.Equal(123, status.ChannelId);
        Assert.Equal("Planning", status.Status);
    }

    [Fact]
    public void ToChannelStatusesMessageSetsEventAndOmitsMissingStatuses() {
        var message = ChannelInfoProjection.ToChannelStatusesMessage(10, [
            new VoiceChannelState(1, "Planning"),
            new VoiceChannelState(2, null),
            new VoiceChannelState(3, ""),
        ]);

        Assert.Equal(ChannelInfoProjection.ChannelStatusesEvent, message.Event);
        Assert.Equal(10, message.Payload.GuildId);
        var status = Assert.Single(message.Payload.Channels);
        Assert.Equal(1, status.ChannelId);
        Assert.Equal("Planning", status.Status);
    }

    [Fact]
    public void ToChannelInfoMessageSetsEvent() {
        var message = ChannelInfoProjection.ToChannelInfoMessage(
            10,
            [new VoiceChannelState(1, "Planning")],
            new HashSet<string>(StringComparer.Ordinal) { "status" }
        );

        Assert.Equal(ChannelInfoProjection.ChannelInfoEvent, message.Event);
        Assert.Equal(10, message.Payload.GuildId);
        var info = Assert.Single(message.Payload.Channels);
        Assert.Equal(1, info.ChannelId);
        Assert.Equal("Planning", info.Status);
        Assert.True(info.IncludeStatus);
    }

    [Fact]
    public void ChannelInfoJsonIncludesRequestedNullFields() {
        var info = ChannelInfoProjection.ToChannelInfo(
            new VoiceChannelState(123, null),
            new HashSet<string>(StringComparer.Ordinal) {
                "status",
                "voice_start_time",
            }
        );

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(info, OffloadJsonOptions));
        var root = document.RootElement;

        Assert.Equal("123", root.GetProperty("id").GetString());
        Assert.Equal(JsonValueKind.Null, root.GetProperty("status").ValueKind);
        Assert.Equal(JsonValueKind.Null, root.GetProperty("voice_start_time").ValueKind);
    }

    [Fact]
    public void ChannelInfoJsonOmitsUnrequestedFields() {
        var info = ChannelInfoProjection.ToChannelInfo(
            new VoiceChannelState(123, "Planning"),
            new HashSet<string>(StringComparer.Ordinal)
        );

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(info, OffloadJsonOptions));
        var root = document.RootElement;

        Assert.Equal("123", root.GetProperty("id").GetString());
        Assert.False(root.TryGetProperty("status", out _));
        Assert.False(root.TryGetProperty("voice_start_time", out _));
    }
}
