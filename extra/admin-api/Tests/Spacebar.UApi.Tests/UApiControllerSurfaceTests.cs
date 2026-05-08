using System.Reflection;
using Microsoft.AspNetCore.Mvc.Routing;
using Spacebar.UApi.Services;
using Xunit;

namespace Spacebar.UApi.Tests;

public class UApiControllerSurfaceTests {
    [Fact]
    public void DoesNotRegisterPartialNativeGuildStickerRoute() {
        var assembly = typeof(PermissionService).Assembly;

        var guildStickerRouteTypes = assembly.GetTypes()
            .Where(type => GetRouteTemplates(type).Any(IsGuildStickerRoute))
            .Select(type => type.FullName)
            .ToArray();

        Assert.DoesNotContain(assembly.GetTypes(), type => type.Name == "GuildStickerController");
        Assert.Empty(guildStickerRouteTypes);
    }

    private static IEnumerable<string> GetRouteTemplates(Type controllerType) {
        var controllerTemplates = controllerType.GetCustomAttributes(inherit: true)
            .OfType<IRouteTemplateProvider>()
            .Select(route => route.Template)
            .Where(template => !string.IsNullOrWhiteSpace(template))
            .Cast<string>()
            .ToArray();

        foreach (var controllerTemplate in controllerTemplates)
            yield return controllerTemplate;

        var methodTemplates = controllerType
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
            .SelectMany(method => method.GetCustomAttributes(inherit: true).OfType<IRouteTemplateProvider>())
            .Select(route => route.Template)
            .Where(template => !string.IsNullOrWhiteSpace(template))
            .Cast<string>()
            .ToArray();

        foreach (var methodTemplate in methodTemplates) {
            yield return methodTemplate;

            foreach (var controllerTemplate in controllerTemplates)
                yield return CombineRouteTemplates(controllerTemplate, methodTemplate);
        }
    }

    private static string CombineRouteTemplates(string controllerTemplate, string methodTemplate) {
        if (methodTemplate.StartsWith('/') || methodTemplate.StartsWith("~/", StringComparison.Ordinal))
            return methodTemplate;

        return $"{controllerTemplate.TrimEnd('/')}/{methodTemplate.TrimStart('/')}";
    }

    private static bool IsGuildStickerRoute(string template) {
        var segments = template
            .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(segment => segment.ToLowerInvariant())
            .ToArray();

        var guildsIndex = Array.IndexOf(segments, "guilds");
        var stickersIndex = Array.IndexOf(segments, "stickers");

        return guildsIndex >= 0 && stickersIndex > guildsIndex;
    }
}
