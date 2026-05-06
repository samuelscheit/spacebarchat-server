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
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ajv } from "../../Validator";

interface JsonShape {
    anyOf?: JsonShape[];
    items?: JsonShape;
    additionalProperties?: JsonShape | boolean;
    enum?: (number | string)[];
    pattern?: string;
    properties?: Record<string, JsonShape>;
    required?: string[];
    $ref?: string;
}

const DISCORD_AUDIT_LOG_EVENT_TYPES = [
    1, 10, 11, 12, 13, 14, 15, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31, 32, 40, 41, 42, 50, 51, 52, 60, 61, 62, 72, 73, 74, 75, 80, 81, 82, 83, 84, 85, 90, 91, 92, 100, 101,
    102, 110, 111, 112, 121, 130, 131, 132, 140, 141, 142, 143, 144, 145, 146, 150, 151, 163, 164, 165, 166, 167, 190, 191, 192, 193,
] as const;

function readSchemas(): Record<string, JsonShape> {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonShape>;
}

function resolveRef(schemas: Record<string, JsonShape>, shape: JsonShape | undefined): JsonShape | undefined {
    if (!shape?.$ref?.startsWith("#/definitions/")) return shape;

    return schemas[shape.$ref.slice("#/definitions/".length)];
}

function collectRefs(shape: JsonShape | undefined): string[] {
    if (!shape) return [];

    return [
        ...(shape.$ref ? [shape.$ref] : []),
        ...collectRefs(shape.items),
        ...(typeof shape.additionalProperties === "object" ? collectRefs(shape.additionalProperties) : []),
        ...(shape.anyOf ?? []).flatMap((child) => collectRefs(child)),
    ];
}

function responseWithChanges(changes: object[], action_type = 1): object {
    return {
        application_commands: [],
        audit_log_entries: [
            {
                id: "100",
                action_type,
                changes,
            },
        ],
        guild_scheduled_events: [],
        integrations: [],
        threads: [],
        users: [],
        webhooks: [],
        auto_moderation_rules: [],
    };
}

test("AuditLogResponse validates current Discord audit-log action types", () => {
    const schemas = readSchemas();
    const actionTypeEnum = resolveRef(schemas, schemas.AuditLogEntry.properties?.action_type)?.enum ?? [];

    assert.equal(actionTypeEnum.length, new Set(actionTypeEnum).size, "AuditLogEvents schema must not contain duplicate values");

    for (const actionType of DISCORD_AUDIT_LOG_EVENT_TYPES) {
        assert.ok(actionTypeEnum.includes(actionType), `AuditLogEvents schema is missing ${actionType}`);
        assert.equal(ajv.validate("AuditLogResponse", responseWithChanges([], actionType)), true, `${actionType}: ${JSON.stringify(ajv.errors)}`);
    }

    assert.equal(ajv.validate("AuditLogResponse", responseWithChanges([], 999)), false, "unknown audit-log action_type should be rejected");
});

test("AuditLogChange exposes changed values directly", () => {
    const schemas = readSchemas();
    const auditLogChange = resolveRef(schemas, schemas.AuditLogEntry.properties?.changes?.items);
    const changeBranches = (auditLogChange?.anyOf ?? []).map((shape) => resolveRef(schemas, shape));
    const genericChange = changeBranches.find((shape) => shape?.properties?.key?.pattern?.includes("$add"));
    const partialRoleChange = changeBranches.find((shape) => shape?.properties?.key?.enum?.includes("$add"));
    const permissionChange = changeBranches.find((shape) => shape?.properties?.key?.pattern === "^\\d+$");
    const genericValueRefs = collectRefs(genericChange?.properties?.new_value);

    assert.deepEqual(schemas.AuditLogPartialRole.required, ["id", "name"]);
    assert.equal(genericChange?.properties?.key?.pattern, "^(?!(?:\\$add|\\$remove|\\d+)$).+$");
    assert.deepEqual(partialRoleChange?.properties?.key?.enum, ["$add", "$remove"]);
    assert.equal(partialRoleChange?.properties?.new_value?.items?.$ref, "#/definitions/AuditLogPartialRole");
    assert.equal(permissionChange?.properties?.key?.pattern, "^\\d+$");
    assert.equal(permissionChange?.properties?.new_value?.$ref, "#/definitions/AuditLogApplicationCommandPermissionValue");
    assert.ok(genericValueRefs.includes("#/definitions/ChannelPermissionOverwrite"));
});

test("AuditLogChange validates scalar and partial-role values", () => {
    assert.equal(
        ajv.validate(
            "AuditLogResponse",
            responseWithChanges([
                { key: "name", old_value: "old", new_value: "new" },
                { key: "position", old_value: 1, new_value: 2 },
                { key: "metadata", new_value: { nested: ["value"], count: 1 } },
                { key: "$add", new_value: [{ id: "123", name: "moderator" }] },
                { key: "$remove", new_value: [{ id: "123", name: "moderator" }] },
                {
                    key: "456",
                    old_value: { id: "456", type: 1, permission: true },
                    new_value: { id: "456", type: 1, permission: false },
                },
            ]),
        ),
        true,
    );
});

test("AuditLogChange rejects invalid special-key values", () => {
    for (const changes of [
        [
            {
                key: "$add",
                new_value: { $add: [{ id: "123", name: "moderator" }] },
            },
        ],
        [
            {
                key: "$remove",
                new_value: [{ id: "123" }],
            },
        ],
        [
            {
                key: "$add",
                new_value: "moderator",
            },
        ],
        [
            {
                key: "456",
                new_value: "permission",
            },
        ],
        [
            {
                key: "456",
                new_value: { id: "456", type: 1 },
            },
        ],
    ]) {
        assert.equal(ajv.validate("AuditLogResponse", responseWithChanges(changes)), false, JSON.stringify(ajv.errors));
    }
});
