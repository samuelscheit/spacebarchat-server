using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Spacebar.Interop.Cdn.Signing;

namespace Spacebar.Cdn.Services;

public class CdnAttachmentAccessService(CdnAttachmentSecurityOptions options, CdnSigningService signingService) {
    public bool HasAccess(HttpRequest request, PathString path) {
        if (request.Headers.TryGetValue("signature", out var signatureHeader) &&
            HasMatchingInternalRequestSignature(signatureHeader.ToString())) {
            return true;
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

    private bool HasMatchingInternalRequestSignature(string signatureHeader) {
        if (string.IsNullOrEmpty(options.RequestSignature) || string.IsNullOrEmpty(signatureHeader)) {
            return false;
        }

        var expected = Encoding.UTF8.GetBytes(options.RequestSignature);
        var actual = Encoding.UTF8.GetBytes(signatureHeader);

        return expected.Length == actual.Length && CryptographicOperations.FixedTimeEquals(expected, actual);
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

        try {
            value = DateTimeOffset.FromUnixTimeMilliseconds(milliseconds);
            return true;
        }
        catch (ArgumentOutOfRangeException) {
            return false;
        }
    }

    private static string? GetClientIp(HttpRequest request) {
        return request.HttpContext.Connection.RemoteIpAddress?.ToString();
    }
}
