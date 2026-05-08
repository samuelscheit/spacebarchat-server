using System.ComponentModel;
using ImageMagick;

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

        Assert.Equal(expectedFormat, format);
        Assert.Equal(expectedMime, Mimes.GetMime(format));
    }

    [Theory]
    [InlineData("msl")]
    [InlineData("mvg")]
    [InlineData("file")]
    [InlineData("ftp")]
    [InlineData("http")]
    [InlineData("https")]
    [InlineData("pdf")]
    [InlineData("ps")]
    [InlineData("eps")]
    [InlineData("screenshot")]
    [InlineData("clipboard")]
    [InlineData("x")]
    [InlineData("dds")]
    [InlineData("mpr")]
    [InlineData("unknown")]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void GetFormatForExtension_RejectsUnsupportedAndDangerousMagickCoders(string? extension) {
        Assert.Throws<InvalidEnumArgumentException>(() => Mimes.GetFormatForExtension(extension));
    }
}
