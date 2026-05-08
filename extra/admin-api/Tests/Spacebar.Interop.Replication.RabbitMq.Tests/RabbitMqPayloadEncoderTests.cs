using System.Text;
using Spacebar.Interop.Replication.RabbitMq;

namespace Spacebar.Interop.Replication.RabbitMq.Tests;

public class RabbitMqPayloadEncoderTests {
    [Fact]
    public void EncodePublishesByteArraysAsRawPayloads() {
        byte[] payload = [0, 1, 2, 255];

        var encoded = RabbitMqPayloadEncoder.Encode(payload);

        Assert.Equal(payload, encoded.Body.ToArray());
        Assert.Equal("application/octet-stream", encoded.ContentType);
    }

    [Fact]
    public void EncodePublishesMemoryPayloadsAsRawPayloads() {
        var payload = new byte[] { 9, 8, 7, 6 };

        var readOnlyEncoded = RabbitMqPayloadEncoder.Encode(new ReadOnlyMemory<byte>(payload, 1, 2));
        var memoryEncoded = RabbitMqPayloadEncoder.Encode(new Memory<byte>(payload, 2, 2));
        var segmentEncoded = RabbitMqPayloadEncoder.Encode(new ArraySegment<byte>(payload, 0, 3));

        Assert.Equal([8, 7], readOnlyEncoded.Body.ToArray());
        Assert.Equal([7, 6], memoryEncoded.Body.ToArray());
        Assert.Equal([9, 8, 7], segmentEncoded.Body.ToArray());
        Assert.Equal("application/octet-stream", readOnlyEncoded.ContentType);
        Assert.Equal("application/octet-stream", memoryEncoded.ContentType);
        Assert.Equal("application/octet-stream", segmentEncoded.ContentType);
    }

    [Fact]
    public void EncodeJsonSerializesStructuredPayloads() {
        var encoded = RabbitMqPayloadEncoder.Encode(new {
            event_name = "READY",
            count = 2,
        });

        Assert.Equal("""{"event_name":"READY","count":2}""", Encoding.UTF8.GetString(encoded.Body.Span));
        Assert.Equal("application/json", encoded.ContentType);
    }

    [Fact]
    public void EncodeJsonSerializesStrings() {
        var encodedString = RabbitMqPayloadEncoder.Encode("payload");

        Assert.Equal("\"payload\"", Encoding.UTF8.GetString(encodedString.Body.Span));
        Assert.Equal("application/json", encodedString.ContentType);
    }

    [Fact]
    public void EncodeJsonSerializesContentlessBodiesAsExplicitJsonNullForPublish() {
        var encodedNull = RabbitMqPayloadEncoder.Encode(null);

        Assert.Equal("null", Encoding.UTF8.GetString(encodedNull.Body.Span));
        Assert.Equal(4, encodedNull.Body.Length);
        Assert.Equal("application/json", encodedNull.ContentType);
    }
}
