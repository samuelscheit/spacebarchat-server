/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { ApplicationCommand, DiscordApiErrors, type Message } from "@spacebar/util";
import { ApplicationCommandType, InteractionType } from "@spacebar/schemas";
import { buildMessageInteractionDataResponse } from "./interaction-data";

const originalFindOne = ApplicationCommand.findOne;

afterEach(() => {
    ApplicationCommand.findOne = originalFindOne;
});

describe("buildMessageInteractionDataResponse", () => {
    test("resolves the persisted application command and preserves submitted options", async () => {
        const findCalls: unknown[] = [];
        ApplicationCommand.findOne = (async (options: unknown) => {
            findCalls.push(options);
            return {
                id: "command-id",
                application_id: "application-id",
                name: "ping",
                description: "Measure latency",
                options: [],
                default_member_permissions: null,
                version: "command-version",
                type: ApplicationCommandType.CHAT_INPUT,
            };
        }) as typeof ApplicationCommand.findOne;

        const response = await buildMessageInteractionDataResponse({
            application_id: "application-id",
            interaction_metadata: {
                id: "interaction-id",
                type: InteractionType.ApplicationCommand,
                user_id: "user-id",
                authorizing_integration_owners: { "1": "user-id" },
                application_command_id: "command-id",
                name: "ping",
                command_type: ApplicationCommandType.CHAT_INPUT,
                options: [{ type: 3, name: "query", value: "spacebar" }],
            },
        } as unknown as Message);

        assert.deepEqual(findCalls, [{ where: { id: "command-id", application_id: "application-id" } }]);
        assert.equal(response.id, "interaction-id");
        assert.equal(response.type, InteractionType.ApplicationCommand);
        assert.equal(response.name, "ping");
        assert.equal(response.application_command.id, "command-id");
        assert.equal(response.application_command.name, "ping");
        assert.deepEqual(response.options, [{ type: 3, name: "query", value: "spacebar" }]);
    });

    test("falls back to a stored application command snapshot when the command was deleted", async () => {
        ApplicationCommand.findOne = (async () => null) as typeof ApplicationCommand.findOne;

        const response = await buildMessageInteractionDataResponse({
            application_id: "application-id",
            interaction_metadata: {
                id: "interaction-id",
                type: InteractionType.ApplicationCommand,
                user_id: "user-id",
                authorizing_integration_owners: { "1": "user-id" },
                application_command: {
                    id: "command-id",
                    application_id: "application-id",
                    name: "ping",
                    description: "Measure latency",
                    options: [],
                    default_member_permissions: null,
                    version: "command-version",
                    type: ApplicationCommandType.CHAT_INPUT,
                },
                name: "ping",
                command_type: ApplicationCommandType.CHAT_INPUT,
            },
        } as unknown as Message);

        assert.equal(response.application_command.id, "command-id");
        assert.equal(response.name, "ping");
    });

    test("rejects messages without interaction metadata", async () => {
        await assert.rejects(
            () =>
                buildMessageInteractionDataResponse({
                    application_id: "application-id",
                } as unknown as Message),
            (error) => error === DiscordApiErrors.UNKNOWN_INTERACTION,
        );
    });
});
