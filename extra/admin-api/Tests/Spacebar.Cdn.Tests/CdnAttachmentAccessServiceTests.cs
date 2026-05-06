using System.Net;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Spacebar.Cdn.Services;
using Spacebar.Interop.Cdn.Signing;

namespace Spacebar.Cdn.Tests;

public class CdnAttachmentAccessServiceTests {
    [Fact]
    public void HasAccess_AllowsUnsignedRequestsWhenSigningDisabled() {
        var service = NewAccessService(cdnSignUrls: false);
        var context = NewContext("/attachments/1/2/file.png");

        Assert.True(service.HasAccess(context.Request, context.Request.Path));
    }

    [Fact]
    public void HasAccess_AllowsInternalRequestSignature() {
        var service = NewAccessService(cdnSignUrls: true);
        var context = NewContext("/attachments/1/2/file.png");
        context.Request.Headers["signature"] = "internal-secret";

        Assert.True(service.HasAccess(context.Request, context.Request.Path));
    }

    [Fact]
    public void HasAccess_RejectsInvalidInternalRequestSignature() {
        var service = NewAccessService(cdnSignUrls: true);
        var context = NewContext("/attachments/1/2/file.png");
        context.Request.Headers["signature"] = "wrong-secret";

        Assert.False(service.HasAccess(context.Request, context.Request.Path));
    }

    [Fact]
    public void HasAccess_ValidatesSignedAttachmentUrl() {
        var signingService = NewSigningService();
        var service = NewAccessService(cdnSignUrls: true, signingService);
        var context = NewContext("/attachments/1/2/file.png");
        var signature = signingService.Sign(new CdnSignature {
            Path = context.Request.Path,
            IpAddress = "127.0.0.1",
            UserAgent = "test-agent",
        });

        context.Request.QueryString = new QueryString($"?is={signature.CreatedAt.ToUnixTimeMilliseconds():x}&ex={signature.ExpiresAt.ToUnixTimeMilliseconds():x}&hm={signature.Signature}");

        Assert.True(service.HasAccess(context.Request, context.Request.Path));
    }

    [Fact]
    public void HasAccess_RejectsMissingSignedAttachmentUrl() {
        var service = NewAccessService(cdnSignUrls: true);
        var context = NewContext("/attachments/1/2/file.png");

        Assert.False(service.HasAccess(context.Request, context.Request.Path));
    }

    private static CdnAttachmentAccessService NewAccessService(bool cdnSignUrls, CdnSigningService? signingService = null) {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> {
                ["Spacebar:Security:RequestSignature"] = "internal-secret",
                ["Spacebar:Security:CdnSignUrls"] = cdnSignUrls.ToString(),
                ["Spacebar:Security:CdnSignatureKey"] = "test-secret",
                ["Spacebar:Security:CdnSignatureIncludeIp"] = "true",
                ["Spacebar:Security:CdnSignatureIncludeUserAgent"] = "true",
            })
            .Build();

        return new CdnAttachmentAccessService(
            new CdnAttachmentSecurityOptions(configuration),
            signingService ?? NewSigningService()
        );
    }

    private static CdnSigningService NewSigningService() {
        return new CdnSigningService(
            NullLogger<CdnSigningService>.Instance,
            Encoding.UTF8.GetBytes("test-secret"),
            requireUserAgent: true,
            requireIpAddress: true,
            expiryTime: TimeSpan.FromMinutes(5)
        );
    }

    private static DefaultHttpContext NewContext(string path) {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Connection.RemoteIpAddress = IPAddress.Parse("127.0.0.1");
        context.Request.Headers.UserAgent = "test-agent";
        return context;
    }
}
