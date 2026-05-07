using System.Text;
using System.Text.Json;

namespace Spacebar.Interop.Replication.RabbitMq;

public static class RabbitMqPayloadEncoder {
    public static RabbitMqPayload Encode(object? body) =>
        body switch {
            null => Json("null"),
            byte[] bytes => Binary(bytes),
            ReadOnlyMemory<byte> memory => Binary(memory),
            Memory<byte> memory => Binary(memory),
            ArraySegment<byte> segment => Binary(segment.AsMemory()),
            _ => Json(JsonSerializer.Serialize(body)),
        };

    private static RabbitMqPayload Json(string json) => new(Encoding.UTF8.GetBytes(json), "application/json");

    private static RabbitMqPayload Binary(ReadOnlyMemory<byte> bytes) => new(bytes, "application/octet-stream");
}

public readonly record struct RabbitMqPayload(ReadOnlyMemory<byte> Body, string ContentType);
