using System.ComponentModel;

namespace Spacebar.Cdn.Shared;

public readonly record struct CdnImageOutputFormat(string MagickFormatName, string MimeType);

public static class CdnImageOutputFormats {
    private static readonly Dictionary<string, CdnImageOutputFormat> SafeFormatsByExtension = new(StringComparer.OrdinalIgnoreCase) {
        ["apng"] = new("APng", "image/apng"),
        ["png"] = new("Png", "image/png"),
        ["jpg"] = new("Jpeg", "image/jpeg"),
        ["jpeg"] = new("Jpeg", "image/jpeg"),
        ["gif"] = new("Gif", "image/gif"),
        ["bmp"] = new("Bmp", "image/bmp"),
        ["tif"] = new("Tiff", "image/tiff"),
        ["tiff"] = new("Tiff", "image/tiff"),
        ["webp"] = new("WebP", "image/webp"),
    };

    private static readonly Dictionary<string, string> MimeTypesByFormatName = new(StringComparer.OrdinalIgnoreCase) {
        ["APng"] = "image/apng",
        ["Png"] = "image/png",
        ["Jpeg"] = "image/jpeg",
        ["Jpg"] = "image/jpeg",
        ["Gif"] = "image/gif",
        ["Bmp"] = "image/bmp",
        ["Tiff"] = "image/tiff",
        ["Tif"] = "image/tiff",
        ["WebP"] = "image/webp",
    };

    public static string GetSafeMagickFormatNameForExtension(string? extension, IEnumerable<string> knownMagickFormatNames) {
        if (!TryNormalizeExtension(extension, out var normalizedExtension))
            throw new InvalidEnumArgumentException("Unknown format: " + extension);

        if (SafeFormatsByExtension.TryGetValue(normalizedExtension, out var safeFormat)) return safeFormat.MagickFormatName;

        if (knownMagickFormatNames.Any(format => string.Equals(format, normalizedExtension, StringComparison.OrdinalIgnoreCase)))
            throw new AccessViolationException("Disallowed extension: " + normalizedExtension);

        throw new InvalidEnumArgumentException("Unknown format: " + normalizedExtension);
    }

    public static bool TryGetMimeType(string magickFormatName, out string mimeType) {
        var found = MimeTypesByFormatName.TryGetValue(magickFormatName, out var value);
        mimeType = value ?? string.Empty;
        return found;
    }

    private static bool TryNormalizeExtension(string? extension, out string normalizedExtension) {
        normalizedExtension = string.Empty;
        if (string.IsNullOrWhiteSpace(extension)) return false;

        normalizedExtension = extension.Trim().TrimStart('.');
        return normalizedExtension.Length > 0;
    }
}
