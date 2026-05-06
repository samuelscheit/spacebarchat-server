namespace Spacebar.Cdn.Services;

public static class AttachmentContentType {
    private static readonly Dictionary<string, string> ExtensionMimeTypes = new(StringComparer.OrdinalIgnoreCase) {
        [".apng"] = "image/apng",
        [".avif"] = "image/avif",
        [".bmp"] = "image/bmp",
        [".css"] = "text/css",
        [".gif"] = "image/gif",
        [".htm"] = "text/html",
        [".html"] = "text/html",
        [".jpeg"] = "image/jpeg",
        [".jpg"] = "image/jpeg",
        [".js"] = "text/javascript",
        [".json"] = "application/json",
        [".mhtml"] = "text/mhtml",
        [".mp3"] = "audio/mpeg",
        [".mp4"] = "video/mp4",
        [".pdf"] = "application/pdf",
        [".png"] = "image/png",
        [".svg"] = "image/svg+xml",
        [".txt"] = "text/plain",
        [".webm"] = "video/webm",
        [".webp"] = "image/webp",
        [".xhtml"] = "application/xhtml+xml",
        [".xml"] = "application/xml",
    };

    private static readonly HashSet<string> SanitizedMimeTypes = new(StringComparer.OrdinalIgnoreCase) {
        "application/xhtml+xml",
        "multipart/related",
        "text/html",
        "text/mhtml",
    };

    public static string FromFilename(string filename) {
        var extension = Path.GetExtension(filename);
        var mimeType = !string.IsNullOrEmpty(extension) && ExtensionMimeTypes.TryGetValue(extension, out var known)
            ? known
            : "application/octet-stream";

        return SanitizedMimeTypes.Contains(mimeType) ? "application/octet-stream" : mimeType;
    }
}
