using System.Text.Json;
using System.Text.Json.Serialization;
using Spacebar.Interop.Replication.Abstractions;
using Spacebar.Models.Gateway;

namespace Spacebar.Offload.Tests;

public class IdentifyControllerCloseMessageTests {
    private static readonly JsonSerializerOptions OffloadJsonOptions = new() {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    [Theory]
    [InlineData(null, true, null, null)]
    [InlineData(new[] { 0, 1 }, true, 0, 1)]
    [InlineData(new[] { 1, 2 }, true, 1, 2)]
    [InlineData(new int[] { }, false, null, null)]
    [InlineData(new[] { 0 }, false, null, null)]
    [InlineData(new[] { -1, 1 }, false, null, null)]
    [InlineData(new[] { 0, 0 }, false, null, null)]
    [InlineData(new[] { 1, 1 }, false, null, null)]
    public void IdentifyRequestValidatesShardBeforeControllerIndexing(int[]? shard, bool expectedValid, int? expectedShardId, int? expectedShardCount) {
        var request = new IdentifyRequest {
            Shard = shard,
        };

        var valid = request.TryGetShard(out var shardId, out var shardCount);

        Assert.Equal(expectedValid, valid);
        Assert.Equal(expectedShardId, shardId);
        Assert.Equal(expectedShardCount, shardCount);
    }

    [Fact]
    public void GatewayCloseResponseSerializesAsOffloadClosePayload() {
        var message = new ReplicationMessage<GatewayCloseResponse> {
            Origin = "IdentifyController",
            Event = "SB_GW_CLOSE",
            Payload = new GatewayCloseResponse {
                Code = CloseCode.InvalidShard,
            },
        };

        Assert.IsType<GatewayCloseResponse>(message.Payload);
        Assert.Equal(CloseCode.InvalidShard, message.Payload.Code);

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(message, OffloadJsonOptions));
        var root = document.RootElement;

        Assert.Equal("IdentifyController", root.GetProperty("origin").GetString());
        Assert.Equal("SB_GW_CLOSE", root.GetProperty("event").GetString());
        Assert.Equal((int)CloseCode.InvalidShard, root.GetProperty("data").GetProperty("code").GetInt32());
    }
}
