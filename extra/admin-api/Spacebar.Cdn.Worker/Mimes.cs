using System.ComponentModel;
using ImageMagick;

namespace Spacebar.Cdn.Worker;

// Keep up to date with CDN!
public static class Mimes {
    private static readonly Dictionary<string, MagickFormat> SafeOutputFormats = new(StringComparer.OrdinalIgnoreCase) {
        ["png"] = MagickFormat.Png,
        ["jpg"] = MagickFormat.Jpg,
        ["jpeg"] = MagickFormat.Jpeg,
        ["gif"] = MagickFormat.Gif,
        ["bmp"] = MagickFormat.Bmp,
        ["tif"] = MagickFormat.Tiff,
        ["tiff"] = MagickFormat.Tiff,
        ["webp"] = MagickFormat.WebP,
    };

    private static string PrintLogged(string msg, string mime) {
        Console.WriteLine($"{msg}: {mime}");
        return mime;
    }

    public static MagickFormat GetFormatForExtension(string extension) {
        if (string.IsNullOrWhiteSpace(extension)) throw new InvalidEnumArgumentException("Unknown format: " + extension);

        extension = extension.Trim().TrimStart('.');
        if (SafeOutputFormats.TryGetValue(extension, out var format)) return format;

        if (Enum.GetNames<MagickFormat>().Any(f => string.Equals(f, extension, StringComparison.OrdinalIgnoreCase)))
            throw new AccessViolationException("Disallowed extension: " + extension);

        throw new InvalidEnumArgumentException("Unknown format: " + extension);
    }

    public static string GetMime(MagickFormat fmt) => fmt switch {
        MagickFormat.Png => "image/png",
        MagickFormat.Jpeg or MagickFormat.Jpg => "image/jpeg",
        MagickFormat.Gif => "image/gif",
        MagickFormat.Bmp => "image/bmp",
        MagickFormat.Tiff => "image/tiff",
        MagickFormat.WebP => "image/webp",
        _ => PrintLogged("Unknown mime for format " + fmt.ToString() + "!", "application/octet-stream")
    };
}
