using System.Text.Json;
using System.Text.Json.Nodes;
using Spacebar.Models.Generic;

namespace Spacebar.Models.Generic.Tests;

public class ActivitySerializationTests {
    [Fact]
    public void DeserializeActivityPreservesKnownPresenceShape() {
        const string json = """
                            {
                                "name": "Spotify",
                                "type": 2,
                                "created_at": 1710000000123,
                                "timestamps": { "start": 1710000000000, "end": 1710000300000 },
                                "application_id": "123456789012345678",
                                "details": "Track",
                                "state": "Artist",
                                "emoji": { "name": "note", "id": "234567890123456789", "animated": false },
                                "party": { "id": "party-id", "size": [1, 5] },
                                "assets": {
                                    "large_image": "album",
                                    "large_text": "Album",
                                    "small_image": "spotify",
                                    "small_text": "Spotify"
                                },
                                "secrets": { "join": "join-secret", "spectate": "spectate-secret", "match": "match-secret" },
                                "instance": true,
                                "flags": "48",
                                "id": "spotify:1",
                                "sync_id": "track-id",
                                "metadata": {
                                    "button_urls": ["https://example.com"],
                                    "context_uri": "spotify:album:1",
                                    "album_id": "album-id",
                                    "artist_ids": ["artist-id"],
                                    "type": "track"
                                },
                                "session_id": "session-id"
                            }
                            """;

        var activity = JsonSerializer.Deserialize<Activity>(json);

        Assert.NotNull(activity);
        Assert.Equal("Spotify", activity.Name);
        Assert.Equal(ActivityType.Listening, activity.Type);
        Assert.Equal(1710000000123, activity.CreatedAt);
        Assert.Equal(1710000000000, activity.Timestamps?.Start);
        Assert.Equal(1710000300000, activity.Timestamps?.End);
        Assert.Equal(123456789012345678, activity.ApplicationId);
        Assert.Equal(234567890123456789, activity.Emoji?.Id);
        Assert.Equal([1, 5], activity.Party?.Size);
        Assert.Equal("album", activity.Assets?.LargeImage);
        Assert.Equal("match-secret", activity.Secrets?.Match);
        Assert.True(activity.Instance);
        Assert.Equal("48", activity.Flags);
        Assert.Equal("track-id", activity.SyncId);
        Assert.Equal(["https://example.com"], activity.Metadata?.ButtonUrls);
        Assert.Equal("track", activity.Metadata?.Type);
        Assert.Equal("session-id", activity.SessionId);
    }

    [Fact]
    public void SerializePresenceActivitiesUseDiscordFieldNames() {
        var presence = new Presence {
            User = new PartialUser {
                Id = 111111111111111111,
                Username = "space",
                Discriminator = "0001",
            },
            GuildId = 222222222222222222,
            Status = "online",
            ClientStatus = new Presence.ClientStatuses { Web = "online" },
            Activities = [
                new Activity {
                    Name = "Spacebar",
                    Type = ActivityType.Game,
                    ApplicationId = 333333333333333333,
                    Assets = new ActivityAssets {
                        LargeImage = "large",
                        SmallText = "small text",
                    },
                    Metadata = new ActivityMetadata {
                        ButtonUrls = ["https://spacebar.chat"],
                    },
                }
            ],
            HiddenActivities = [
                new Activity {
                    Name = "Hidden",
                    Type = ActivityType.Custom,
                    Emoji = new ActivityEmoji {
                        Name = "wave",
                        Id = 444444444444444444,
                    },
                }
            ],
        };

        var json = JsonSerializer.Serialize(presence);
        var node = JsonNode.Parse(json)!;

        Assert.Equal("111111111111111111", node["user"]!["id"]!.GetValue<string>());
        Assert.Equal("222222222222222222", node["guild_id"]!.GetValue<string>());
        Assert.Equal("333333333333333333", node["activities"]![0]!["application_id"]!.GetValue<string>());
        Assert.Equal("large", node["activities"]![0]!["assets"]!["large_image"]!.GetValue<string>());
        Assert.Equal("small text", node["activities"]![0]!["assets"]!["small_text"]!.GetValue<string>());
        Assert.Equal("https://spacebar.chat", node["activities"]![0]!["metadata"]!["button_urls"]![0]!.GetValue<string>());
        Assert.Equal("444444444444444444", node["hidden_activities"]![0]!["emoji"]!["id"]!.GetValue<string>());
        Assert.Null(node["activities"]![0]!["url"]);
    }

    [Fact]
    public void SerializePresenceDefaultsActivitiesToEmptyArrayAndOmitsHiddenActivities() {
        var presence = new Presence {
            User = new PartialUser {
                Id = 111111111111111111,
                Username = "space",
                Discriminator = "0001",
            },
            Status = "online",
        };

        var json = JsonSerializer.Serialize(presence);
        var node = JsonNode.Parse(json)!;

        Assert.Empty(node["activities"]!.AsArray());
        Assert.Null(node["hidden_activities"]);
        Assert.Equal("online", node["status"]!.GetValue<string>());
    }
}
