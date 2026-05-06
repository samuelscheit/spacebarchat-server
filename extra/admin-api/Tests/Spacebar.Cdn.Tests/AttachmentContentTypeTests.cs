using Spacebar.Cdn.Services;

namespace Spacebar.Cdn.Tests;

public class AttachmentContentTypeTests {
    [Theory]
    [InlineData("image.png", "image/png")]
    [InlineData("video.webm", "video/webm")]
    [InlineData("unknown.bin", "application/octet-stream")]
    public void FromFilename_ReturnsKnownSafeTypes(string filename, string expected) {
        Assert.Equal(expected, AttachmentContentType.FromFilename(filename));
    }

    [Theory]
    [InlineData("index.html")]
    [InlineData("archive.mhtml")]
    [InlineData("page.xhtml")]
    public void FromFilename_SanitizesBrowserExecutableTypes(string filename) {
        Assert.Equal("application/octet-stream", AttachmentContentType.FromFilename(filename));
    }
}
