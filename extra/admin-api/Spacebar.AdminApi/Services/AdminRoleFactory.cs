using Spacebar.Models.Db.Models;

namespace Spacebar.AdminApi.Services;

/// <summary>
/// Creates roles used by admin-only guild mutations.
/// </summary>
internal static class AdminRoleFactory {
    internal const string InstanceAdministratorColorsJson = """{"primary_color":0}""";

    public static Role CreateInstanceAdministrator(long guildId, long roleId, int position) =>
        new() {
            Id = roleId,
            GuildId = guildId,
            Name = "Instance administrator",
            Color = 0,
            Colors = InstanceAdministratorColorsJson,
            Hoist = false,
            Position = position,
            Permissions = "8",
            Managed = false,
            Mentionable = false,
            Flags = 0,
        };
}
