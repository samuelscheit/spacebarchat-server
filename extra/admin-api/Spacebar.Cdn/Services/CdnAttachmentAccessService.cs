using System.Globalization;
using Microsoft.AspNetCore.Http;
using Spacebar.Interop.Cdn.Signing;

namespace Spacebar.Cdn.Services;

public class CdnAttachmentAccessService(CdnAttachmentSecurityOptions options, CdnSigningService signingService) {
    public bool HasAccess(HttpRequest request, PathString path) {
        if (request.Headers.TryGetValue("signature", out var signatureHeader)) {
            return signatureHeader.ToString() == options.RequestSignature;
        }

        if (!options.CdnSignUrls) {
            return true;
        }

        if (!TryReadSignature(request, path, out var signature)) {
            return false;
        }

        signature.IpAddress = GetClientIp(request);
        signature.UserAgent = request.Headers.UserAgent.ToString();

        return signingService.Verify(signature);
    }

    private static bool TryReadSignature(HttpRequest request, PathString path, out CdnSignatureResult signature) {
        signature = null!;

        var query = request.Query;
        if (!query.TryGetValue("is", out var issuedAt) ||
            !query.TryGetValue("ex", out var expiresAt) ||
            !query.TryGetValue("hm", out var hash) ||
            string.IsNullOrEmpty(issuedAt) ||
            string.IsNullOrEmpty(expiresAt) ||
            string.IsNullOrEmpty(hash)) {
            return false;
        }

        if (!TryParseUnixMilliseconds(issuedAt!, out var createdAt) ||
            !TryParseUnixMilliseconds(expiresAt!, out var expiresAtDate)) {
            return false;
        }

        signature = new CdnSignatureResult {
            Path = path.ToString(),
            CreatedAt = createdAt,
            ExpiresAt = expiresAtDate,
            Signature = hash.ToString(),
        };
        return true;
    }

    private static bool TryParseUnixMilliseconds(string hexValue, out DateTimeOffset value) {
        value = default;
        if (!long.TryParse(hexValue, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var milliseconds)) {
            return false;
        }

        value = DateTimeOffset.FromUnixTimeMilliseconds(milliseconds);
        return true;
    }

    private static string? GetClientIp(HttpRequest request) {
        if (request.Headers.TryGetValue("X-Forwarded-For", out var forwardedFor) && !string.IsNullOrWhiteSpace(forwardedFor)) {
            return forwardedFor.ToString().Split(',')[0].Trim();
        }

        return request.HttpContext.Connection.RemoteIpAddress?.ToString();
    }
}
