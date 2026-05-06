using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Spacebar.Interop.Cdn.Signing;

namespace Spacebar.Cdn.Tests;

public class CdnSigningServiceTests {
    [Fact]
    public void Verify_AcceptsMatchingSignature() {
        var service = NewService();
        var signature = service.Sign(new CdnSignature {
            Path = "/attachments/1/2/file.png",
            IpAddress = "127.0.0.1",
            UserAgent = "test-agent",
        });

        Assert.True(service.Verify(signature, signature.CreatedAt.AddSeconds(1)));
    }

    [Fact]
    public void Verify_RejectsTamperedPath() {
        var service = NewService();
        var signature = service.Sign(new CdnSignature {
            Path = "/attachments/1/2/file.png",
            IpAddress = "127.0.0.1",
            UserAgent = "test-agent",
        });

        signature.Path = "/attachments/1/2/other.png";

        Assert.False(service.Verify(signature, signature.CreatedAt.AddSeconds(1)));
    }

    [Fact]
    public void Verify_RejectsExpiredSignature() {
        var service = NewService();
        var signature = service.Sign(new CdnSignature {
            Path = "/attachments/1/2/file.png",
            IpAddress = "127.0.0.1",
            UserAgent = "test-agent",
        });

        Assert.False(service.Verify(signature, signature.ExpiresAt.AddMilliseconds(1)));
    }

    private static CdnSigningService NewService() {
        return new CdnSigningService(
            NullLogger<CdnSigningService>.Instance,
            Encoding.UTF8.GetBytes("test-secret"),
            requireUserAgent: true,
            requireIpAddress: true,
            expiryTime: TimeSpan.FromMinutes(5)
        );
    }
}
