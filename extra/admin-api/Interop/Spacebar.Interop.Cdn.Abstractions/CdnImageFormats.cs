using System.ComponentModel;
using ImageMagick;
using Spacebar.Cdn.Shared;

namespace Spacebar.Interop.Cdn.Abstractions;

public static class CdnImageFormats {
    private static readonly string[] MagickFormatNames = Enum.GetNames<MagickFormat>();

    public static MagickFormat GetFormatForExtension(string? extension) => ParseFormat(
        CdnImageOutputFormats.GetSafeMagickFormatNameForExtension(extension, MagickFormatNames));

    public static string GetMime(MagickFormat fmt) => CdnImageOutputFormats.TryGetMimeType(fmt.ToString(), out var mime)
        ? mime
        : PrintLogged("Unknown mime for format " + fmt.ToString() + "!", "application/octet-stream");

    private static MagickFormat ParseFormat(string magickFormatName) => Enum.TryParse(magickFormatName, out MagickFormat fmt)
        ? fmt
        : throw new InvalidEnumArgumentException("Unknown format: " + magickFormatName);

    private static string PrintLogged(string msg, string mime) {
        Console.WriteLine($"{msg}: {mime}");
        return mime;
    }
}
