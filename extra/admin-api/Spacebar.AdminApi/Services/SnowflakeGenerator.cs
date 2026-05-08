namespace Spacebar.AdminApi.Services;

/// <summary>
/// Generates Discord-compatible snowflake identifiers for Spacebar database rows.
/// </summary>
public static class SnowflakeGenerator {
    /// <summary>
    /// Discord epoch: 2015-01-01T00:00:00.000Z.
    /// </summary>
    public const long EpochMilliseconds = 1420070400000L;

    private const int WorkerIdBits = 5;
    private const int ProcessIdBits = 5;
    private const int IncrementBits = 12;
    private const int MaxWorkerId = (1 << WorkerIdBits) - 1;
    private const int MaxProcessId = (1 << ProcessIdBits) - 1;
    private const int MaxIncrement = (1 << IncrementBits) - 1;
    private const int TimestampShift = WorkerIdBits + ProcessIdBits + IncrementBits;
    private const int WorkerIdShift = ProcessIdBits + IncrementBits;
    private const int ProcessIdShift = IncrementBits;

    private static readonly object Sync = new();
    private static readonly int ProcessId = Environment.ProcessId & MaxProcessId;
    private static long lastTimestampMilliseconds = -1;
    private static int increment = -1;

    /// <summary>
    /// Generates a positive signed 64-bit snowflake using the current UTC time.
    /// </summary>
    public static long Generate() {
        lock (Sync) {
            var timestampMilliseconds = CurrentTimestampMilliseconds();
            if (timestampMilliseconds < lastTimestampMilliseconds) {
                timestampMilliseconds = lastTimestampMilliseconds;
            }

            if (timestampMilliseconds == lastTimestampMilliseconds) {
                increment = (increment + 1) & MaxIncrement;
                if (increment == 0) {
                    timestampMilliseconds = WaitForNextMillisecond(lastTimestampMilliseconds);
                }
            }
            else {
                increment = 0;
            }

            lastTimestampMilliseconds = timestampMilliseconds;
            return Compose(timestampMilliseconds, workerId: 0, ProcessId, increment);
        }
    }

    /// <summary>
    /// Extracts the UTC creation timestamp encoded in a snowflake.
    /// </summary>
    public static DateTimeOffset GetTimestamp(long snowflake) {
        var timestampMilliseconds = (snowflake >> TimestampShift) + EpochMilliseconds;
        return DateTimeOffset.FromUnixTimeMilliseconds(timestampMilliseconds);
    }

    internal static long ComposeForTests(DateTimeOffset timestamp, int workerId, int processId, int increment) {
        return Compose(ToTimestampMilliseconds(timestamp), workerId, processId, increment);
    }

    private static long Compose(long timestampMilliseconds, int workerId, int processId, int increment) {
        if (timestampMilliseconds < 0) {
            throw new ArgumentOutOfRangeException(nameof(timestampMilliseconds), "Snowflake timestamps must be on or after the Discord epoch.");
        }

        if (workerId is < 0 or > MaxWorkerId) {
            throw new ArgumentOutOfRangeException(nameof(workerId), $"Worker ID must be between 0 and {MaxWorkerId}.");
        }

        if (processId is < 0 or > MaxProcessId) {
            throw new ArgumentOutOfRangeException(nameof(processId), $"Process ID must be between 0 and {MaxProcessId}.");
        }

        if (increment is < 0 or > MaxIncrement) {
            throw new ArgumentOutOfRangeException(nameof(increment), $"Increment must be between 0 and {MaxIncrement}.");
        }

        return (timestampMilliseconds << TimestampShift)
               | ((long)workerId << WorkerIdShift)
               | ((long)processId << ProcessIdShift)
               | (uint)increment;
    }

    private static long CurrentTimestampMilliseconds() {
        return ToTimestampMilliseconds(DateTimeOffset.UtcNow);
    }

    private static long ToTimestampMilliseconds(DateTimeOffset timestamp) {
        return timestamp.ToUnixTimeMilliseconds() - EpochMilliseconds;
    }

    private static long WaitForNextMillisecond(long previousTimestampMilliseconds) {
        long timestampMilliseconds;
        do {
            Thread.SpinWait(128);
            timestampMilliseconds = CurrentTimestampMilliseconds();
        } while (timestampMilliseconds <= previousTimestampMilliseconds);

        return timestampMilliseconds;
    }
}
