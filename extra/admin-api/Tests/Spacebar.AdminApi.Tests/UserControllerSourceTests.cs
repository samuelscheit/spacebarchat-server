using Microsoft.AspNetCore.Mvc.Routing;
using Spacebar.AdminApi.Controllers;

namespace Spacebar.AdminApi.Tests;

public class UserControllerSourceTests {
    [Fact]
    public void UserControllerDoesNotExposeDmsRoute() {
        var routeTemplates = typeof(UserController)
            .GetMethods()
            .SelectMany(method => method.GetCustomAttributes(typeof(HttpMethodAttribute), inherit: true))
            .Cast<HttpMethodAttribute>()
            .Select(attribute => attribute.Template)
            .Where(template => template is not null);

        Assert.DoesNotContain("{id}/Dms", routeTemplates);
    }

    [Fact]
    public async Task UserControllerDoesNotContainStaleDmsTodoStub() {
        var source = await File.ReadAllTextAsync(FindRepoFile("extra/admin-api/Spacebar.AdminApi/Controllers/UserController.cs"));

        Assert.DoesNotContain("GetDmsAsync", source, StringComparison.Ordinal);
        Assert.DoesNotContain("{id}/Dms", source, StringComparison.Ordinal);
        Assert.DoesNotContain("yield break; // TODO", source, StringComparison.Ordinal);
    }

    private static string FindRepoFile(string relativePath) {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent) {
            var candidate = Path.Combine(directory.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
        }

        throw new FileNotFoundException($"Could not find repository file '{relativePath}' from '{AppContext.BaseDirectory}'.");
    }
}
