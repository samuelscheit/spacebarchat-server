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
    private const string WorkerIdEnvironmentVariable = "SPACEBAR_SNOWFLAKE_WORKER_ID";

    private static readonly object Sync = new();
    private static readonly int WorkerId = ResolveWorkerId(Environment.GetEnvironmentVariable(WorkerIdEnvironmentVariable), Environment.MachineName);
    private static readonly int ProcessId = Environment.ProcessId & MaxProcessId;
    private static long _lastTimestampMilliseconds = -1;
    private static int _increment = -1;

    /// <summary>
    /// Generates a positive signed 64-bit snowflake using the current UTC time.
    /// </summary>
    public static long Generate() {
        lock (Sync) {
            var timestampMilliseconds = CurrentTimestampMilliseconds();
            if (timestampMilliseconds < _lastTimestampMilliseconds) {
                timestampMilliseconds = _lastTimestampMilliseconds;
            }

            if (timestampMilliseconds == _lastTimestampMilliseconds) {
                _increment = (_increment + 1) & MaxIncrement;
                if (_increment == 0) {
                    timestampMilliseconds = WaitForNextMillisecond(_lastTimestampMilliseconds);
                }
            }
            else {
                _increment = 0;
            }

            _lastTimestampMilliseconds = timestampMilliseconds;
            return Compose(timestampMilliseconds, WorkerId, ProcessId, _increment);
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

    internal static int ResolveWorkerId(string? configuredWorkerId, string machineName) {
        if (!string.IsNullOrWhiteSpace(configuredWorkerId)) {
            if (int.TryParse(configuredWorkerId, out var workerId) && workerId is >= 0 and <= MaxWorkerId) {
                return workerId;
            }

            throw new InvalidOperationException($"{WorkerIdEnvironmentVariable} must be an integer between 0 and {MaxWorkerId}.");
        }

        return StableFiveBitHash(string.IsNullOrWhiteSpace(machineName) ? "spacebar-admin-api" : machineName);
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

    private static int StableFiveBitHash(string value) {
        const uint fnvOffsetBasis = 2166136261;
        const uint fnvPrime = 16777619;

        var hash = fnvOffsetBasis;
        unchecked {
            foreach (var character in value) {
                hash ^= character;
                hash *= fnvPrime;
            }
        }

        return (int)(hash & MaxWorkerId);
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
