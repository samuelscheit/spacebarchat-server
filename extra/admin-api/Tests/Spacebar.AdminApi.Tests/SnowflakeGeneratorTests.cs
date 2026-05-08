using Spacebar.AdminApi.Services;

namespace Spacebar.AdminApi.Tests;

public class SnowflakeGeneratorTests {
    [Fact]
    public void ComposeForTests_UsesDiscordSnowflakeBitLayout() {
        var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(SnowflakeGenerator.EpochMilliseconds + 1_234_567);

        var snowflake = SnowflakeGenerator.ComposeForTests(timestamp, workerId: 17, processId: 9, increment: 3210);

        Assert.Equal(1_234_567L, snowflake >> 22);
        Assert.Equal(17, (snowflake >> 17) & 0b1_1111);
        Assert.Equal(9, (snowflake >> 12) & 0b1_1111);
        Assert.Equal(3210, snowflake & 0b1111_1111_1111);
    }

    [Fact]
    public void GetTimestamp_ReturnsTimestampEncodedInSnowflake() {
        var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(SnowflakeGenerator.EpochMilliseconds + 987_654_321);
        var snowflake = SnowflakeGenerator.ComposeForTests(timestamp, workerId: 0, processId: 0, increment: 0);

        Assert.Equal(timestamp, SnowflakeGenerator.GetTimestamp(snowflake));
    }

    [Fact]
    public void Generate_ReturnsPositiveInt8CompatibleSnowflake() {
        var snowflake = SnowflakeGenerator.Generate();

        Assert.True(snowflake > 0);
        Assert.True(snowflake <= long.MaxValue);
        Assert.True(SnowflakeGenerator.GetTimestamp(snowflake) <= DateTimeOffset.UtcNow.AddMilliseconds(1));
    }

    [Fact]
    public void Generate_ReturnsUniqueMonotonicSnowflakes() {
        var snowflakes = Enumerable.Range(0, 10_000).Select(_ => SnowflakeGenerator.Generate()).ToArray();

        Assert.Equal(snowflakes.Length, snowflakes.Distinct().Count());
        Assert.True(snowflakes.Zip(snowflakes.Skip(1), (previous, current) => current > previous).All(x => x));
    }
}
