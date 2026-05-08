using System.Globalization;
using System.Text.Json;
using Spacebar.Models.Generic;
using Spacebar.Models.Generic.Constants;
using DbChannel = Spacebar.Models.Db.Models.Channel;
using DbChannelType = Spacebar.Models.Db.Models.ChannelType;
using DbMember = Spacebar.Models.Db.Models.Member;

namespace Spacebar.GatewayOffload;

public static class LazyMemberListChannelAccess {
    private const int RoleOverwriteType = 0;
    private const int MemberOverwriteType = 1;
    private const string EveryoneListId = "everyone";
    private static readonly ulong ViewChannelFlag = (ulong)Permissions.ViewChannel;
    private static readonly ulong AdministratorFlag = (ulong)Permissions.Administrator;

    public static DbChannel GetPermissionChannel(DbChannel requestedChannel) =>
        IsThreadChannel(requestedChannel) && requestedChannel.Parent is not null
            ? requestedChannel.Parent
            : requestedChannel;

    public static IReadOnlyList<ChannelPermissionOverwrite> ParsePermissionOverwrites(string? permissionOverwrites) {
        if (string.IsNullOrWhiteSpace(permissionOverwrites)) return [];

        try {
            return JsonSerializer.Deserialize<List<ChannelPermissionOverwrite>>(permissionOverwrites) ?? [];
        }
        catch (JsonException) {
            return [];
        }
    }

    public static string GetMemberListId(DbChannel channel) => GetMemberListId(ParsePermissionOverwrites(channel.PermissionOverwrites));

    public static string GetMemberListId(IEnumerable<ChannelPermissionOverwrite> overwrites) {
        var listIdParts = overwrites
            .Select(overwrite => {
                if ((overwrite.Allow & ViewChannelFlag) == ViewChannelFlag) return $"allow:{overwrite.Id}";
                if ((overwrite.Deny & ViewChannelFlag) == ViewChannelFlag) return $"deny:{overwrite.Id}";
                return null;
            })
            .Where(part => part is not null)
            .Select(part => part!)
            .Order(StringComparer.Ordinal)
            .ToArray();

        return listIdParts.Length == 0
            ? EveryoneListId
            : MurmurHash3(string.Join(',', listIdParts)).ToString(CultureInfo.InvariantCulture);
    }

    public static IReadOnlyList<DbMember> FilterVisibleMembers(IEnumerable<DbMember> members, DbChannel channel, long? guildOwnerId) {
        var overwrites = ParsePermissionOverwrites(channel.PermissionOverwrites);
        return members.Where(member => CanViewChannel(member, overwrites, guildOwnerId)).ToList();
    }

    public static bool CanViewChannel(DbMember member, DbChannel channel, long? guildOwnerId) =>
        CanViewChannel(member, ParsePermissionOverwrites(channel.PermissionOverwrites), guildOwnerId);

    public static bool CanViewChannel(DbMember member, IEnumerable<ChannelPermissionOverwrite> overwrites, long? guildOwnerId) {
        if (member.Id == 0 || guildOwnerId == member.Id) return true;

        var permissions = member.Roles.Aggregate(0UL, (current, role) => current | ParsePermissions(role.Permissions));
        if (HasPermission(permissions, AdministratorFlag)) return true;

        var roleIds = member.Roles.Select(role => role.Id).ToHashSet();
        var orderedOverwrites = overwrites.ToList();

        foreach (var overwrite in orderedOverwrites.Where(overwrite => IsEveryoneOverwrite(overwrite, member.GuildId))) {
            permissions = ApplyOverwrite(permissions, overwrite);
        }

        var roleDeny = 0UL;
        var roleAllow = 0UL;
        foreach (var overwrite in orderedOverwrites.Where(overwrite => IsRoleOverwrite(overwrite, member.GuildId, roleIds))) {
            roleDeny |= overwrite.Deny;
            roleAllow |= overwrite.Allow;
        }
        permissions = (permissions & ~roleDeny) | roleAllow;

        foreach (var overwrite in orderedOverwrites.Where(overwrite => IsMemberOverwrite(overwrite, member))) {
            permissions = ApplyOverwrite(permissions, overwrite);
        }

        return HasPermission(permissions, ViewChannelFlag) || HasPermission(permissions, AdministratorFlag);
    }

    private static ulong ApplyOverwrite(ulong permissions, ChannelPermissionOverwrite overwrite) =>
        (permissions & ~overwrite.Deny) | overwrite.Allow;

    private static bool IsEveryoneOverwrite(ChannelPermissionOverwrite overwrite, long guildId) =>
        overwrite.Type == RoleOverwriteType &&
        string.Equals(overwrite.Id, guildId.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal);

    private static bool IsRoleOverwrite(ChannelPermissionOverwrite overwrite, long guildId, IReadOnlySet<long> roleIds) =>
        overwrite.Type == RoleOverwriteType &&
        !string.Equals(overwrite.Id, guildId.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal) &&
        long.TryParse(overwrite.Id, NumberStyles.None, CultureInfo.InvariantCulture, out var roleId) &&
        roleIds.Contains(roleId);

    private static bool IsMemberOverwrite(ChannelPermissionOverwrite overwrite, DbMember member) =>
        overwrite.Type == MemberOverwriteType &&
        string.Equals(overwrite.Id, member.Id.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal);

    private static ulong ParsePermissions(string? permissions) =>
        ulong.TryParse(permissions, NumberStyles.None, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0UL;

    private static bool HasPermission(ulong permissions, ulong permission) => (permissions & permission) == permission;

    private static bool IsThreadChannel(DbChannel channel) =>
        channel.Type is DbChannelType.GuildNewsThread or DbChannelType.GuildPublicThread or DbChannelType.GuildPrivateThread;

    private static uint MurmurHash3(string key, uint seed = 0) {
        const uint c1 = 0xcc9e2d51;
        const uint c2 = 0x1b873593;

        unchecked {
            var h1 = seed;
            var roundedEnd = key.Length & ~0x3;

            for (var i = 0; i < roundedEnd; i += 4) {
                var k1 = (uint)(key[i] & 0xff)
                         | ((uint)(key[i + 1] & 0xff) << 8)
                         | ((uint)(key[i + 2] & 0xff) << 16)
                         | ((uint)(key[i + 3] & 0xff) << 24);

                k1 *= c1;
                k1 = RotateLeft(k1, 15);
                k1 *= c2;

                h1 ^= k1;
                h1 = RotateLeft(h1, 13);
                h1 = h1 * 5 + 0xe6546b64;
            }

            var tail = 0U;
            switch (key.Length & 3) {
                case 3:
                    tail ^= (uint)(key[roundedEnd + 2] & 0xff) << 16;
                    goto case 2;
                case 2:
                    tail ^= (uint)(key[roundedEnd + 1] & 0xff) << 8;
                    goto case 1;
                case 1:
                    tail ^= (uint)(key[roundedEnd] & 0xff);
                    tail *= c1;
                    tail = RotateLeft(tail, 15);
                    tail *= c2;
                    h1 ^= tail;
                    break;
            }

            h1 ^= (uint)key.Length;
            h1 ^= h1 >> 16;
            h1 *= 0x85ebca6b;
            h1 ^= h1 >> 13;
            h1 *= 0xc2b2ae35;
            h1 ^= h1 >> 16;

            return h1;
        }
    }

    private static uint RotateLeft(uint value, int count) => (value << count) | (value >> (32 - count));
}
