using System.Globalization;
using System.Text.Json;
using Spacebar.Models.Generic;
using Spacebar.Models.Generic.Constants;

namespace Spacebar.GatewayOffload.Extensions.Gateway;

public static class LazyMemberListProjection {
    public const string EveryoneListId = "everyone";

    public static string GetMemberListId(string? permissionOverwritesJson) {
        if (string.IsNullOrWhiteSpace(permissionOverwritesJson)) {
            return EveryoneListId;
        }

        var permissionOverwrites = JsonSerializer.Deserialize<List<ChannelPermissionOverwrite>>(permissionOverwritesJson) ?? [];
        if (permissionOverwrites.Count == 0) {
            return EveryoneListId;
        }

        var viewChannel = (ulong)Permissions.ViewChannel;
        var permissionListEntries = permissionOverwrites
            .Select(overwrite => GetPermissionListEntry(overwrite, viewChannel))
            .OfType<string>()
            .Order(StringComparer.Ordinal)
            .ToList();

        return permissionListEntries.Count == 0
            ? EveryoneListId
            : MurmurHash3.Hash32(string.Join(',', permissionListEntries)).ToString(CultureInfo.InvariantCulture);
    }

    private static string? GetPermissionListEntry(ChannelPermissionOverwrite overwrite, ulong permission) {
        if ((overwrite.Allow & permission) != 0) {
            return $"allow:{overwrite.Id}";
        }

        if ((overwrite.Deny & permission) != 0) {
            return $"deny:{overwrite.Id}";
        }

        return null;
    }
}

internal static class MurmurHash3 {
    public static uint Hash32(string key, uint seed = 0) {
        const uint c1 = 0xcc9e2d51;
        const uint c2 = 0x1b873593;

        var h1 = seed;
        var bytes = key.Length - (key.Length & 3);
        var i = 0;

        while (i < bytes) {
            var k1 = (uint)(
                (key[i] & 0xff) |
                ((key[++i] & 0xff) << 8) |
                ((key[++i] & 0xff) << 16) |
                ((key[++i] & 0xff) << 24));
            ++i;

            k1 *= c1;
            k1 = RotateLeft(k1, 15);
            k1 *= c2;

            h1 ^= k1;
            h1 = RotateLeft(h1, 13);
            h1 = (h1 * 5) + 0xe6546b64;
        }

        uint tail = 0;
        switch (key.Length & 3) {
            case 3:
                tail ^= (uint)((key[i + 2] & 0xff) << 16);
                goto case 2;
            case 2:
                tail ^= (uint)((key[i + 1] & 0xff) << 8);
                goto case 1;
            case 1:
                tail ^= (uint)(key[i] & 0xff);
                tail *= c1;
                tail = RotateLeft(tail, 15);
                tail *= c2;
                h1 ^= tail;
                break;
        }

        h1 ^= (uint)key.Length;
        h1 = Fmix(h1);
        return h1;
    }

    private static uint RotateLeft(uint value, int count) => (value << count) | (value >> (32 - count));

    private static uint Fmix(uint hash) {
        hash ^= hash >> 16;
        hash *= 0x85ebca6b;
        hash ^= hash >> 13;
        hash *= 0xc2b2ae35;
        hash ^= hash >> 16;
        return hash;
    }
}
