using System.Text.Json;
using System.Text.Json.Serialization;
using Spacebar.Interop.Replication.Abstractions;
using Spacebar.Models.Gateway;

namespace Spacebar.Offload.Tests;

public class IdentifyControllerCloseMessageTests {
    private static readonly JsonSerializerOptions OffloadJsonOptions = new() {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

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
