using System.ComponentModel;
using ImageMagick;

namespace Spacebar.Cdn.Tests;

public class MimesTests {
    [Theory]
    [InlineData("png", MagickFormat.Png, "image/png")]
    [InlineData("jpg", MagickFormat.Jpg, "image/jpeg")]
    [InlineData("jpeg", MagickFormat.Jpeg, "image/jpeg")]
    [InlineData("gif", MagickFormat.Gif, "image/gif")]
    [InlineData("bmp", MagickFormat.Bmp, "image/bmp")]
    [InlineData("tif", MagickFormat.Tiff, "image/tiff")]
    [InlineData("tiff", MagickFormat.Tiff, "image/tiff")]
    [InlineData("webp", MagickFormat.WebP, "image/webp")]
    public void GetFormatForExtension_AllowsExpectedImageOutputFormats(string extension, MagickFormat expectedFormat, string expectedMime) {
        var format = Mimes.GetFormatForExtension(extension);
        var workerFormat = Spacebar.Cdn.Worker.Mimes.GetFormatForExtension(extension);

        Assert.Equal(expectedFormat, format);
        Assert.Equal(expectedFormat, workerFormat);
        Assert.Equal(expectedMime, Mimes.GetMime(format));
        Assert.Equal(expectedMime, Spacebar.Cdn.Worker.Mimes.GetMime(workerFormat));
    }

    [Theory]
    [InlineData("PNG", MagickFormat.Png)]
    [InlineData(".WebP", MagickFormat.WebP)]
    [InlineData(" tiff ", MagickFormat.Tiff)]
    public void GetFormatForExtension_NormalizesCommonExtensionInput(string extension, MagickFormat expectedFormat) {
        Assert.Equal(expectedFormat, Mimes.GetFormatForExtension(extension));
        Assert.Equal(expectedFormat, Spacebar.Cdn.Worker.Mimes.GetFormatForExtension(extension));
    }

    [Theory]
    [InlineData("screenshot")]
    [InlineData("win")]
    [InlineData("clipboard")]
    [InlineData("x")]
    [InlineData("xwd")]
    [InlineData("open")]
    [InlineData("print")]
    [InlineData("scan")]
    [InlineData("dmr")]
    [InlineData("mpr")]
    [InlineData("pdf")]
    [InlineData("svg")]
    [InlineData("mp4")]
    [InlineData("url")]
    public void GetFormatForExtension_RejectsFormatsOutsideCdnOutputAllowlist(string extension) {
        Assert.IsAssignableFrom<Exception>(Record.Exception(() => Mimes.GetFormatForExtension(extension)));
        Assert.IsAssignableFrom<Exception>(Record.Exception(() => Spacebar.Cdn.Worker.Mimes.GetFormatForExtension(extension)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-a-real-format")]
    public void GetFormatForExtension_RejectsUnknownFormats(string extension) {
        Assert.Throws<InvalidEnumArgumentException>(() => Mimes.GetFormatForExtension(extension));
        Assert.Throws<InvalidEnumArgumentException>(() => Spacebar.Cdn.Worker.Mimes.GetFormatForExtension(extension));
    }
}
