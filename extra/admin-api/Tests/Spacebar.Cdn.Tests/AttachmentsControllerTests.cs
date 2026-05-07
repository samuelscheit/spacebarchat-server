using System.Net;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Spacebar.Cdn.Controllers;
using Spacebar.Cdn.Services;
using Spacebar.Interop.Cdn.Abstractions;
using Spacebar.Interop.Cdn.Signing;

namespace Spacebar.Cdn.Tests;

public class AttachmentsControllerTests {
    [Fact]
    public async Task GetAttachment_ReturnsStreamResultForValidPath() {
        var controller = NewController("/attachments/123/456/file.png", out var fileSource);

        var result = await controller.GetAttachment("123", "456", "file.png");

        var fileResult = Assert.IsType<FileStreamResult>(result);
        Assert.Equal("image/png", fileResult.ContentType);
        Assert.Equal("attachments/123/456/file.png", fileSource.LastPath);
        Assert.Equal("nosniff", controller.Response.Headers["X-Content-Type-Options"].ToString());

        using var resultStream = new MemoryStream();
        await fileResult.FileStream.CopyToAsync(resultStream);
        Assert.Equal(new byte[] { 1, 2, 3 }, resultStream.ToArray());
    }

    [Fact]
    public async Task GetEphemeralAttachment_ReturnsStreamResultForValidPath() {
        var controller = NewController("/ephemeral-attachments/123/456/file.png", out var fileSource);

        var result = await controller.GetEphemeralAttachment("123", "456", "file.png");

        var fileResult = Assert.IsType<FileStreamResult>(result);
        Assert.Equal("ephemeral-attachments/123/456/file.png", fileSource.LastPath);
        Assert.Equal("image/png", fileResult.ContentType);
    }

    [Theory]
    [InlineData("abc", "456", "file.png")]
    [InlineData("123", "456", "../file.png")]
    [InlineData("123", "456", "dir\\file.png")]
    public async Task GetAttachment_RejectsUnsafePathValues(string channelId, string messageId, string filename) {
        var controller = NewController("/attachments/123/456/file.png", out _);

        var result = await controller.GetAttachment(channelId, messageId, filename);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    private static AttachmentsController NewController(string requestPath, out FakeFileSource fileSource) {
        fileSource = new FakeFileSource();
        var controller = new AttachmentsController(fileSource, NewAccessService()) {
            ControllerContext = new ControllerContext {
                HttpContext = NewContext(requestPath),
            },
        };
        return controller;
    }

    private static CdnAttachmentAccessService NewAccessService() {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> {
                ["Spacebar:Security:CdnSignUrls"] = "false",
                ["Spacebar:Security:CdnSignatureKey"] = "test-secret",
            })
            .Build();

        return new CdnAttachmentAccessService(
            new CdnAttachmentSecurityOptions(configuration),
            new CdnSigningService(
                NullLogger<CdnSigningService>.Instance,
                Encoding.UTF8.GetBytes("test-secret"),
                requireUserAgent: false,
                requireIpAddress: false,
                expiryTime: TimeSpan.FromMinutes(5)
            )
        );
    }

    private static DefaultHttpContext NewContext(string path) {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Connection.RemoteIpAddress = IPAddress.Parse("127.0.0.1");
        return context;
    }

    private sealed class FakeFileSource : IFileSource {
        public string BaseUrl => "/cdn";
        public string? LastPath { get; private set; }

        public Task<IFileSource> Init(CancellationToken? cancellationToken = null) {
            return Task.FromResult<IFileSource>(this);
        }

        public Task<Spacebar.Interop.Cdn.Abstractions.FileInfo> GetFile(string path, CancellationToken? cancellationToken = null) {
            LastPath = path;
            return Task.FromResult(new Spacebar.Interop.Cdn.Abstractions.FileInfo {
                Stream = new MemoryStream(new byte[] { 1, 2, 3 }),
                MimeType = "ignored",
            });
        }

        public Task<bool> FileExists(string path, CancellationToken? cancellationToken = null) {
            return Task.FromResult(true);
        }

        public Task WriteFile(string path, Stream stream) {
            return Task.CompletedTask;
        }
    }
}
