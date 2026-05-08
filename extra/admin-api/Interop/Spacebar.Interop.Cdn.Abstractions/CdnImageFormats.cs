using System.ComponentModel;
using ImageMagick;

namespace Spacebar.Interop.Cdn.Abstractions;

public static class CdnImageFormats {
    private static readonly IReadOnlyDictionary<string, MagickFormat> SupportedImageFormats = new Dictionary<string, MagickFormat>(StringComparer.OrdinalIgnoreCase) {
        ["apng"] = MagickFormat.APng,
        ["bmp"] = MagickFormat.Bmp,
        ["gif"] = MagickFormat.Gif,
        ["jpeg"] = MagickFormat.Jpeg,
        ["jpg"] = MagickFormat.Jpeg,
        ["png"] = MagickFormat.Png,
        ["tif"] = MagickFormat.Tiff,
        ["tiff"] = MagickFormat.Tiff,
        ["webp"] = MagickFormat.WebP,
    };

    public static MagickFormat GetFormatForExtension(string? extension) {
        var normalizedExtension = NormalizeExtension(extension);
        return SupportedImageFormats.TryGetValue(normalizedExtension, out var format)
            ? format
            : throw new InvalidEnumArgumentException("Unsupported image format: " + normalizedExtension);
    }

    public static string GetMime(MagickFormat fmt) => fmt switch {
        MagickFormat.APng => "image/apng",
        MagickFormat.Png => "image/png",
        MagickFormat.Jpeg or MagickFormat.Jpg => "image/jpeg",
        MagickFormat.Gif => "image/gif",
        MagickFormat.Bmp => "image/bmp",
        MagickFormat.Tiff or MagickFormat.Tif => "image/tiff",
        MagickFormat.WebP => "image/webp",
        _ => PrintLogged("Unknown mime for format " + fmt.ToString() + "!", "application/octet-stream")
    };

    private static string NormalizeExtension(string? extension) {
        if (string.IsNullOrWhiteSpace(extension)) throw new InvalidEnumArgumentException("Unsupported image format: " + extension);

        return extension.Trim().TrimStart('.').ToLowerInvariant();
    }

    private static string PrintLogged(string msg, string mime) {
        Console.WriteLine($"{msg}: {mime}");
        return mime;
    }
}
