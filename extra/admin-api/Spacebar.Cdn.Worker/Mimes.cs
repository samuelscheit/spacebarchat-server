using ImageMagick;
using Spacebar.Interop.Cdn.Abstractions;

namespace Spacebar.Cdn.Worker;

public static class Mimes {
    public static MagickFormat GetFormatForExtension(string? extension) => CdnImageFormats.GetFormatForExtension(extension);

    public static string GetMime(MagickFormat fmt) => CdnImageFormats.GetMime(fmt);
}
