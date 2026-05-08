namespace Spacebar.Cdn.Services;

public class CdnAttachmentSecurityOptions {
    public CdnAttachmentSecurityOptions(IConfiguration configuration) {
        var security = configuration.GetSection("Spacebar").GetSection("Security");

        RequestSignature = security.GetValue<string>("RequestSignature") ?? string.Empty;
        CdnSignUrls = security.GetValue<bool>("CdnSignUrls");
        CdnSignatureKey = security.GetValue<string>("CdnSignatureKey") ?? string.Empty;
        CdnSignatureIncludeIp = security.GetValue("CdnSignatureIncludeIp", true);
        CdnSignatureIncludeUserAgent = security.GetValue("CdnSignatureIncludeUserAgent", true);

        if (CdnSignUrls && string.IsNullOrEmpty(CdnSignatureKey)) {
            throw new InvalidOperationException("Spacebar:Security:CdnSignatureKey is required when CDN URL signing is enabled.");
        }
    }

    public string RequestSignature { get; }
    public bool CdnSignUrls { get; }
    public string CdnSignatureKey { get; }
    public bool CdnSignatureIncludeIp { get; }
    public bool CdnSignatureIncludeUserAgent { get; }
}
