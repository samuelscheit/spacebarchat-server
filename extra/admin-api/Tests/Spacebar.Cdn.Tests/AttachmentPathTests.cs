using Spacebar.Cdn.Services;

namespace Spacebar.Cdn.Tests;

public class AttachmentPathTests {
    [Fact]
    public void TryBuildAttachment_ReturnsStoragePathForValidSnowflakesAndFilename() {
        Assert.True(AttachmentPath.TryBuildAttachment("123", "456", "file.png", out var path));
        Assert.Equal("attachments/123/456/file.png", path);
    }

    [Fact]
    public void TryBuildEphemeralAttachment_ReturnsStoragePathForValidSnowflakesAndFilename() {
        Assert.True(AttachmentPath.TryBuildEphemeralAttachment("123", "456", "file.png", out var path));
        Assert.Equal("ephemeral-attachments/123/456/file.png", path);
    }

    [Theory]
    [InlineData("abc", "456", "file.png")]
    [InlineData("123", "message", "file.png")]
    [InlineData("123456789012345678901", "456", "file.png")]
    [InlineData("123", "456", "../file.png")]
    [InlineData("123", "456", "dir/file.png")]
    [InlineData("123", "456", "dir\\file.png")]
    [InlineData("123", "456", "file..png")]
    [InlineData("123", "456", "")]
    public void TryBuildAttachment_RejectsUnsafeValues(string channelId, string messageId, string filename) {
        Assert.False(AttachmentPath.TryBuildAttachment(channelId, messageId, filename, out var path));
        Assert.Equal(string.Empty, path);
    }
}
