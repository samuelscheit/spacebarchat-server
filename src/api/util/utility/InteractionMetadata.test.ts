import assert from "node:assert/strict";
import test from "node:test";
import { createApplicationCommandInteractionMessageData } from "./InteractionMetadata";

const applicationCommandInteractionType = 2;
const chatInputCommandType = 1;
const userCommandType = 2;

test("createApplicationCommandInteractionMessageData stores metadata without embedded users", () => {
    const data = createApplicationCommandInteractionMessageData({
        commandName: "ping",
        commandType: userCommandType,
        interactionId: "900",
        userId: "300",
    });

    assert.deepEqual(data.interaction, {
        id: "900",
        name: "ping",
        type: applicationCommandInteractionType,
    });
    assert.deepEqual(data.interaction_metadata, {
        id: "900",
        type: applicationCommandInteractionType,
        user_id: "300",
        authorizing_integration_owners: {
            "1": "300",
        },
        name: "ping",
        command_type: userCommandType,
    });
    assert.equal("user" in data.interaction, false);
    assert.equal("user" in data.interaction_metadata, false);
});

test("createApplicationCommandInteractionMessageData defaults missing command fields", () => {
    const data = createApplicationCommandInteractionMessageData({
        interactionId: "900",
        userId: "300",
    });

    assert.equal(data.interaction.name, "");
    assert.equal(data.interaction_metadata.name, "");
    assert.equal(data.interaction_metadata.command_type, chatInputCommandType);
});
