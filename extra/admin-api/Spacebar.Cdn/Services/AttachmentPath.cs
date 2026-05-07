namespace Spacebar.Cdn.Services;

public static class AttachmentPath {
    public static bool TryBuildAttachment(string channelId, string messageId, string filename, out string path) {
        path = string.Empty;

        if (!IsSnowflakeLike(channelId) ||
            !IsSnowflakeLike(messageId) ||
            !IsSafeFilename(filename)) {
            return false;
        }

        path = $"attachments/{channelId}/{messageId}/{filename}";
        return true;
    }

    public static bool TryBuildEphemeralAttachment(string applicationId, string attachmentId, string filename, out string path) {
        path = string.Empty;

        if (!IsSnowflakeLike(applicationId) ||
            !IsSnowflakeLike(attachmentId) ||
            !IsSafeFilename(filename)) {
            return false;
        }

        path = $"ephemeral-attachments/{applicationId}/{attachmentId}/{filename}";
        return true;
    }

    private static bool IsSnowflakeLike(string value) {
        return value.Length is > 0 and <= 20 && value.All(static c => c is >= '0' and <= '9');
    }

    private static bool IsSafeFilename(string filename) {
        if (string.IsNullOrWhiteSpace(filename) ||
            filename is "." or ".." ||
            filename.Contains("..", StringComparison.Ordinal)) {
            return false;
        }

        return filename.All(static c => c != '/' && c != '\\' && !char.IsControl(c));
    }
}
