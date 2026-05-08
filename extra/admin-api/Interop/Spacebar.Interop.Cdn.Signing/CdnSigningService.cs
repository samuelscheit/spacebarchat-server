using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;

namespace Spacebar.Interop.Cdn.Signing;

public class CdnSigningService(ILogger<CdnSigningService> logger, byte[] signatureKey, bool requireUserAgent, bool requireIpAddress, TimeSpan expiryTime) {
    public CdnSignatureResult Sign(CdnSignature data) {
        if (requireIpAddress && string.IsNullOrEmpty(data.IpAddress)) {
            logger.LogWarning("Signing request missing required IP address");
            throw new ArgumentException("IP address is required for signing");
        }

        if (requireUserAgent && string.IsNullOrEmpty(data.UserAgent)) {
            logger.LogWarning("Signing request missing required User-Agent");
            throw new ArgumentException("User-Agent is required for signing");
        }

        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.Add(expiryTime);

        return Hash(new() {
            Path = data.Path,
            IpAddress = data.IpAddress,
            UserAgent = data.UserAgent,
            CreatedAt = now,
            ExpiresAt = expiresAt,
            Signature = null!
        });
    }

    public bool Verify(CdnSignatureResult data, DateTimeOffset? now = null) {
        if (data.CreatedAt > (now ?? DateTimeOffset.UtcNow)) {
            logger.LogDebug("Signature for {path} was issued in the future", data.Path);
            return false;
        }

        if (data.ExpiresAt < (now ?? DateTimeOffset.UtcNow)) {
            logger.LogDebug("Signature for {path} is expired", data.Path);
            return false;
        }

        var expectedHash = Hash(data).Signature;
        var expected = Encoding.UTF8.GetBytes(expectedHash);
        var actual = Encoding.UTF8.GetBytes(data.Signature);

        return expected.Length == actual.Length && CryptographicOperations.FixedTimeEquals(expected, actual);
    }

    private CdnSignatureResult Hash(CdnSignatureResult data) {
        byte[] signatureData = [
            .. Encoding.UTF8.GetBytes(data.Path),
            .. Encoding.UTF8.GetBytes(data.CreatedAt.ToUnixTimeMilliseconds().ToString("x")),
            .. Encoding.UTF8.GetBytes(data.ExpiresAt.ToUnixTimeMilliseconds().ToString("x")),
            .. (requireIpAddress ? Encoding.UTF8.GetBytes(data.IpAddress ?? string.Empty) : []),
            .. (requireUserAgent ? Encoding.UTF8.GetBytes(data.UserAgent ?? string.Empty) : [])
        ];
        var hash = Convert.ToHexStringLower(HMACSHA256.HashData(signatureKey, signatureData));

        logger.LogTrace("Hash: creating new hash for {path}", data.Path);

        var sr = new CdnSignatureResult() {
            Path = data.Path,
            IpAddress = data.IpAddress,
            UserAgent = data.UserAgent,
            CreatedAt = data.CreatedAt,
            ExpiresAt = data.ExpiresAt,
            Signature = hash,
        };

        logger.LogTrace("Hash: created new hash for {path}, valid between {start} .. {end}: {signature}", data.Path, data.CreatedAt, data.ExpiresAt, sr.Signature);

        return sr;
    }
}
