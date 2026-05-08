using Spacebar.GatewayOffload.Extensions.Gateway;
using Spacebar.Models.Db.Models;

namespace Spacebar.Offload.Tests;

public class SessionPresenceProjectionTests {
    [Theory]
    [InlineData("online", true)]
    [InlineData("idle", true)]
    [InlineData("dnd", true)]
    [InlineData("offline", false)]
    [InlineData("invisible", false)]
    [InlineData("unknown", false)]
    public void IsPubliclyOnlineMatchesGatewaySyncVisibility(string status, bool expected) {
        var session = new Session { Status = status };

        Assert.Equal(expected, SessionPresenceProjection.IsPubliclyOnline(session));
    }

    [Fact]
    public void IsPubliclyOnlineExpressionMatchesInMemoryPredicate() {
        var expressionPredicate = SessionPresenceProjection.IsPubliclyOnlineExpression.Compile();
        var sessions = new[] {
            new Session { SessionId = "online", Status = "online" },
            new Session { SessionId = "idle", Status = "idle" },
            new Session { SessionId = "offline", Status = "offline" },
            new Session { SessionId = "invisible", Status = "invisible" },
            new Session { SessionId = "unknown", Status = "unknown" },
        };

        var expressionResults = sessions.Where(expressionPredicate).Select(session => session.SessionId).ToList();
        var inMemoryResults = sessions.Where(SessionPresenceProjection.IsPubliclyOnline).Select(session => session.SessionId).ToList();

        Assert.Equal(["online", "idle"], expressionResults);
        Assert.Equal(expressionResults, inMemoryResults);
    }
}
