using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Spacebar.Cdn.Fsck;
using Spacebar.Interop.Cdn.Abstractions;
using Spacebar.Interop.Cdn.Signing;
using Spacebar.Models.Db.Contexts;
using FileInfo = Spacebar.Interop.Cdn.Abstractions.FileInfo;
using DbApplication = Spacebar.Models.Db.Models.Application;

namespace Spacebar.Cdn.Migration.Tests;

public class FsckServiceTests {
    [Fact]
    public async Task StartAsync_ChecksApplicationIconsAndCovers() {
        var services = new ServiceCollection();
        var databaseName = Guid.NewGuid().ToString();
        services.AddDbContext<SpacebarDbContext>(options => options.UseInMemoryDatabase(databaseName));
        var provider = services.BuildServiceProvider();

        await using (var scope = provider.CreateAsyncScope()) {
            var db = scope.ServiceProvider.GetRequiredService<SpacebarDbContext>();
            db.Applications.AddRange(
                new DbApplication {
                    Id = 10,
                    Name = "with both",
                    VerifyKey = "verify",
                    Icon = "iconhash",
                    CoverImage = "coverhash",
                },
                new DbApplication {
                    Id = 11,
                    Name = "with icon",
                    VerifyKey = "verify",
                    Icon = "onlyicon",
                },
                new DbApplication {
                    Id = 12,
                    Name = "with cover",
                    VerifyKey = "verify",
                    CoverImage = "onlycover",
                }
            );
            await db.SaveChangesAsync();
        }

        var from = new RecordingFileSource();
        var to = new RecordingFileSource(fileExists: false);
        var service = new FsckService(
            NullLogger<FsckService>.Instance,
            provider.GetRequiredService<IServiceScopeFactory>(),
            new MigrationFileStores {
                From = from,
                To = to,
            },
            new CdnSigningService(
                NullLogger<CdnSigningService>.Instance,
                Encoding.UTF8.GetBytes("test-secret"),
                requireUserAgent: false,
                requireIpAddress: false,
                expiryTime: TimeSpan.FromMinutes(5)
            )
        );

        await service.StartAsync(CancellationToken.None);

        Assert.Contains("/app-icons/10/iconhash", to.ExistsChecks);
        Assert.Contains("/app-icons/11/onlyicon", to.ExistsChecks);
        Assert.Contains("/app-icons/10/coverhash", to.ExistsChecks);
        Assert.Contains("/app-icons/12/onlycover", to.ExistsChecks);
        Assert.DoesNotContain(to.ExistsChecks, path => path.Contains("/app-icons/11/") && path.Contains("cover"));
    }

    private sealed class RecordingFileSource(bool fileExists = true) : IFileSource {
        public string BaseUrl => "memory://cdn";
        public List<string> ExistsChecks { get; } = [];

        public Task<IFileSource> Init(CancellationToken? cancellationToken = null) => Task.FromResult<IFileSource>(this);

        public Task<FileInfo> GetFile(string path, CancellationToken? cancellationToken = null) =>
            Task.FromResult(new FileInfo {
                MimeType = "application/octet-stream",
                Stream = new MemoryStream([1]),
            });

        public Task<bool> FileExists(string path, CancellationToken? cancellationToken = null) {
            ExistsChecks.Add(path);
            return Task.FromResult(fileExists);
        }

        public async Task WriteFile(string path, System.IO.Stream stream) {
            await stream.CopyToAsync(Stream.Null);
        }
    }
}
