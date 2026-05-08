using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.IdentityModel.Tokens;
using Spacebar.AdminApi.Controllers;
using Spacebar.AdminApi.Services;
using Spacebar.Interop.Authentication.AspNetCore;
using Spacebar.Interop.Replication.Abstractions;
using Spacebar.Models.AdminApi;
using Spacebar.Models.Db.Contexts;
using Spacebar.Models.Db.Models;

namespace Spacebar.AdminApi.Tests;

public class GuildControllerTests {
    [Fact]
    public async Task ForceJoinGuild_MakeAdminCreatesPersistableSnowflakeAdminRole() {
        const long guildId = 1_123_000_000_000_000_001;
        const long userId = 1_123_000_000_000_000_002;
        await using var db = CreateDbContext();
        var user = CreateUser(userId);
        var guild = CreateGuild(guildId, userId);
        var everyoneRole = CreateEveryoneRole(guildId);
        var member = CreateMember(guildId, userId, everyoneRole);
        await db.AddRangeAsync(user, guild, everyoneRole, member);
        await db.SaveChangesAsync();
        var controller = CreateController(db, operatorUserId: userId);

        var result = await controller.ForceJoinGuild(new ForceJoinRequest {
            UserId = userId,
            MakeAdmin = true,
        }, guildId);

        Assert.IsType<OkObjectResult>(result);
        var adminRole = await db.Roles.SingleAsync(role => role.GuildId == guildId && role.Permissions == "8");
        Assert.True(adminRole.Id > 0);
        Assert.NotEqual(guildId, adminRole.Id);
        Assert.Equal("Instance administrator", adminRole.Name);
        Assert.Equal(1, adminRole.Position);
        Assert.Equal(0, adminRole.Color);
        Assert.Equal(AdminRoleFactory.InstanceAdministratorColorsJson, adminRole.Colors);
        Assert.Equal(0, adminRole.Flags);
        Assert.True(SnowflakeGenerator.GetTimestamp(adminRole.Id) <= DateTimeOffset.UtcNow.AddMilliseconds(1));

        var persistedMember = await db.Members.Include(x => x.Roles).SingleAsync(x => x.GuildId == guildId && x.Id == userId);
        Assert.Contains(persistedMember.Roles, role => role.Id == adminRole.Id);
    }

    [Fact]
    public void RoleColors_IsRequiredForDatabasePersistence() {
        using var db = CreateDbContext();

        var role = db.Model.FindEntityType(typeof(Role))!.FindProperty(nameof(Role.Colors))!;

        Assert.False(role.IsNullable);
    }

    private static SpacebarDbContext CreateDbContext() =>
        new(new DbContextOptionsBuilder<SpacebarDbContext>()
            .UseInMemoryDatabase($"{nameof(GuildControllerTests)}-{Guid.NewGuid()}")
            .Options);

    private static GuildController CreateController(SpacebarDbContext db, long operatorUserId) =>
        new(
            NullLogger<GuildController>.Instance,
            db,
            new ServiceCollection().BuildServiceProvider(),
            new FakeAuthenticationService(CreateOperatorUser(operatorUserId)),
            new NoopReplication()
        ) {
            ControllerContext = new ControllerContext {
                HttpContext = new DefaultHttpContext(),
            },
        };

    private static Guild CreateGuild(long guildId, long ownerId) =>
        new() {
            Id = guildId,
            Name = "Test guild",
            OwnerId = ownerId,
            Features = "[]",
            WelcomeScreen = "{}",
            ChannelOrdering = "[]",
            MemberCount = 1,
        };

    private static User CreateUser(long userId) =>
        new() {
            Id = userId,
            Username = "operator",
            Discriminator = "0001",
            Bio = "",
            Data = "{}",
            Fingerprints = "[]",
            Rights = (ulong)SpacebarRights.Rights.OPERATOR,
        };

    private static User CreateOperatorUser(long userId) =>
        new() {
            Id = userId,
            Rights = (ulong)SpacebarRights.Rights.OPERATOR,
        };

    private static Role CreateEveryoneRole(long guildId) =>
        new() {
            Id = guildId,
            GuildId = guildId,
            Name = "@everyone",
            Permissions = "0",
            Position = 0,
            Colors = AdminRoleFactory.InstanceAdministratorColorsJson,
        };

    private static Member CreateMember(long guildId, long userId, Role everyoneRole) =>
        new() {
            Id = userId,
            GuildId = guildId,
            JoinedAt = DateTime.UtcNow,
            PremiumSince = 0,
            Roles = [everyoneRole],
            Pending = false,
            Settings = "{}",
            Bio = "",
        };

    private sealed class FakeAuthenticationService(User currentUser) : ISpacebarAspNetAuthenticationService {
        public string GetTokenAsync(HttpRequest request) => "test-token";

        public Task<TokenValidationResult?> ValidateTokenAsync(HttpRequest request) =>
            Task.FromResult<TokenValidationResult?>(new TokenValidationResult {
                IsValid = true,
            });

        public Task<User> GetCurrentUserAsync(HttpRequest request) => Task.FromResult(currentUser);

        public Task<Session> GetCurrentSessionAsync(HttpRequest request) => Task.FromResult(new Session());
    }

    private sealed class NoopReplication : ISpacebarReplication {
        public Task InitializeAsync() => Task.CompletedTask;

        public Task SendAsync(ContentlessReplicationMessage message) => Task.CompletedTask;

        public Task SendAsync<TPayload>(ReplicationMessage<TPayload> message) => Task.CompletedTask;
    }
}
