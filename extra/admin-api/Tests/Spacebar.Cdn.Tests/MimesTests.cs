using System.ComponentModel;
using ImageMagick;
using Spacebar.Interop.Cdn.Abstractions;

namespace Spacebar.Cdn.Tests;

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
        var workerFormat = Spacebar.Cdn.Worker.Mimes.GetFormatForExtension(extension);
        var interopFormat = CdnImageFormats.GetFormatForExtension(extension);

        Assert.Equal(expectedFormat, format);
        Assert.Equal(expectedFormat, workerFormat);
        Assert.Equal(expectedFormat, interopFormat);
        Assert.Equal(expectedMime, Mimes.GetMime(format));
        Assert.Equal(expectedMime, Spacebar.Cdn.Worker.Mimes.GetMime(workerFormat));
        Assert.Equal(expectedMime, CdnImageFormats.GetMime(interopFormat));
    }

    [Theory]
    [InlineData(MagickFormat.Jpg, "image/jpeg")]
    [InlineData(MagickFormat.Tif, "image/tiff")]
    public void GetMime_HandlesSupportedMagickAliases(MagickFormat format, string expectedMime) {
        Assert.Equal(expectedMime, Mimes.GetMime(format));
        Assert.Equal(expectedMime, Spacebar.Cdn.Worker.Mimes.GetMime(format));
        Assert.Equal(expectedMime, CdnImageFormats.GetMime(format));
    }

    [Theory]
    [InlineData("avi")]
    [InlineData("clipboard")]
    [InlineData("data")]
    [InlineData("dds")]
    [InlineData("emf")]
    [InlineData("eps")]
    [InlineData("file")]
    [InlineData("ftp")]
    [InlineData("html")]
    [InlineData("http")]
    [InlineData("https")]
    [InlineData("inline")]
    [InlineData("mkv")]
    [InlineData("mp4")]
    [InlineData("msl")]
    [InlineData("mvg")]
    [InlineData("null")]
    [InlineData("pdf")]
    [InlineData("ps")]
    [InlineData("screenshot")]
    [InlineData("svg")]
    [InlineData("xps")]
    [InlineData(" .PDF ")]
    public void GetFormatForExtension_RejectsKnownMagickFormatsOutsideCdnOutputAllowlist(string extension) {
        Assert.Throws<AccessViolationException>(() => Mimes.GetFormatForExtension(extension));
        Assert.Throws<AccessViolationException>(() => Spacebar.Cdn.Worker.Mimes.GetFormatForExtension(extension));
        Assert.Throws<AccessViolationException>(() => CdnImageFormats.GetFormatForExtension(extension));
    }

    [Theory]
    [InlineData("win")]
    [InlineData("x")]
    [InlineData("xwd")]
    [InlineData("open")]
    [InlineData("print")]
    [InlineData("scan")]
    [InlineData("scanx")]
    [InlineData("dmr")]
    [InlineData("mpr")]
    [InlineData("url")]
    public void GetFormatForExtension_RejectsOtherUnsafeOrUnsupportedOutputAliases(string extension) {
        Assert.NotNull(Record.Exception(() => Mimes.GetFormatForExtension(extension)));
        Assert.NotNull(Record.Exception(() => Spacebar.Cdn.Worker.Mimes.GetFormatForExtension(extension)));
        Assert.NotNull(Record.Exception(() => CdnImageFormats.GetFormatForExtension(extension)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(".")]
    [InlineData("not-a-real-format")]
    public void GetFormatForExtension_RejectsUnknownFormats(string? extension) {
        Assert.Throws<InvalidEnumArgumentException>(() => Mimes.GetFormatForExtension(extension));
        Assert.Throws<InvalidEnumArgumentException>(() => Spacebar.Cdn.Worker.Mimes.GetFormatForExtension(extension));
        Assert.Throws<InvalidEnumArgumentException>(() => CdnImageFormats.GetFormatForExtension(extension));
    }
}
