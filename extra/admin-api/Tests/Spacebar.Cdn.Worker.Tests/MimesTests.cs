using System.ComponentModel;
using ImageMagick;
using Spacebar.Cdn.Worker;

namespace Spacebar.Cdn.Worker.Tests;

public class MimesTests {
    [Theory]
    [InlineData("png", MagickFormat.Png, "image/png")]
    [InlineData(".PNG", MagickFormat.Png, "image/png")]
    [InlineData(" apng ", MagickFormat.APng, "image/apng")]
    [InlineData("jpg", MagickFormat.Jpeg, "image/jpeg")]
    [InlineData("jpeg", MagickFormat.Jpeg, "image/jpeg")]
    [InlineData("gif", MagickFormat.Gif, "image/gif")]
    [InlineData("bmp", MagickFormat.Bmp, "image/bmp")]
    [InlineData("tif", MagickFormat.Tiff, "image/tiff")]
    [InlineData("tiff", MagickFormat.Tiff, "image/tiff")]
    [InlineData("webp", MagickFormat.WebP, "image/webp")]
    public void GetFormatForExtension_AllowsSupportedPublicImageFormats(string extension, MagickFormat expectedFormat, string expectedMime) {
        var format = Mimes.GetFormatForExtension(extension);

        Assert.Equal(expectedFormat, format);
        Assert.Equal(expectedMime, Mimes.GetMime(format));
    }

    [Theory]
    [InlineData("clipboard")]
    [InlineData("data")]
    [InlineData("dds")]
    [InlineData("eps")]
    [InlineData("file")]
    [InlineData("ftp")]
    [InlineData("http")]
    [InlineData("https")]
    [InlineData("msl")]
    [InlineData("mvg")]
    [InlineData("pdf")]
    [InlineData("ps")]
    [InlineData("screenshot")]
    [InlineData("svg")]
    public void GetFormatForExtension_RejectsKnownMagickFormatsOutsideCdnOutputAllowlist(string extension) {
        Assert.Throws<AccessViolationException>(() => Mimes.GetFormatForExtension(extension));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(".")]
    [InlineData("not-a-real-format")]
    public void GetFormatForExtension_RejectsUnknownFormats(string? extension) {
        Assert.Throws<InvalidEnumArgumentException>(() => Mimes.GetFormatForExtension(extension));
    }
}
