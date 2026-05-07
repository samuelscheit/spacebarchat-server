using Microsoft.Extensions.Configuration;
using Spacebar.Cdn.Services;

namespace Spacebar.Cdn.Tests;

public class CdnAttachmentSecurityOptionsTests {
    [Fact]
    public void Constructor_AllowsMissingSecuritySectionWhenSigningDisabledByDefault() {
        var configuration = new ConfigurationBuilder().Build();

        var options = new CdnAttachmentSecurityOptions(configuration);

        Assert.False(options.CdnSignUrls);
        Assert.Equal(string.Empty, options.RequestSignature);
    }

    [Fact]
    public void Constructor_RequiresSigningKeyWhenSigningEnabled() {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> {
                ["Spacebar:Security:CdnSignUrls"] = "true",
            })
            .Build();

        Assert.Throws<InvalidOperationException>(() => new CdnAttachmentSecurityOptions(configuration));
    }
}
