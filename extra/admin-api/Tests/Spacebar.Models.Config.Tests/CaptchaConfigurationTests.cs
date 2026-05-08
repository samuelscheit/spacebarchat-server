using System.Text.Json;
using System.Text.Json.Nodes;
using Spacebar.ConfigModel;

namespace Spacebar.Models.Config.Tests;

public class CaptchaConfigurationTests {
    [Fact]
    public void ServerConfigurationSerializesCaptchaServiceDefaultAsNull() {
        var json = JsonSerializer.Serialize(new ServerConfiguration());
        var node = JsonNode.Parse(json)!;
        var captcha = node["security"]!["captcha"]!;

        Assert.False(captcha["enabled"]!.GetValue<bool>());
        Assert.Null(captcha["service"]);
        Assert.Null(captcha["sitekey"]);
        Assert.Null(captcha["secret"]);
    }

    [Theory]
    [InlineData("recaptcha")]
    [InlineData("hcaptcha")]
    public void ServerConfigurationDeserializesSupportedCaptchaService(string service) {
        var json = $$"""
                     {
                         "security": {
                             "captcha": {
                                 "enabled": true,
                                 "service": "{{service}}",
                                 "sitekey": "captcha-sitekey",
                                 "secret": "captcha-secret"
                             }
                         }
                     }
                     """;

        var config = JsonSerializer.Deserialize<ServerConfiguration>(json);

        Assert.NotNull(config);
        Assert.True(config.Security.Captcha.Enabled);
        Assert.Equal(service, config.Security.Captcha.Service);
        Assert.Equal("captcha-sitekey", config.Security.Captcha.SiteKey);
        Assert.Equal("captcha-secret", config.Security.Captcha.Secret);
    }
}
