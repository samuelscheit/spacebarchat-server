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
    properties?: Record<string, JsonShape>;
    required?: string[];
    $ref?: string;
}

function readSchemas(): Record<string, JsonShape> {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonShape>;
}

function resolveRef(schemas: Record<string, JsonShape>, shape: JsonShape | undefined): JsonShape | undefined {
    if (!shape?.$ref?.startsWith("#/definitions/")) return shape;

    return schemas[shape.$ref.slice("#/definitions/".length)];
}

test("AuditLogChange exposes changed values directly", () => {
    const schemas = readSchemas();
    const auditLogChange = resolveRef(schemas, schemas.AuditLogEntry.properties?.changes?.items);
    const auditLogChangeValue = resolveRef(schemas, resolveRef(schemas, auditLogChange?.anyOf?.[0])?.properties?.new_value);
    const changeValueRefs = (auditLogChangeValue?.anyOf ?? [])
        .map((shape) => resolveRef(schemas, shape.items)?.$ref ?? shape.items?.$ref ?? shape.$ref)
        .filter(Boolean)
        .sort();

    assert.deepEqual(schemas.AuditLogPartialRole.required, ["id", "name"]);
    assert.ok(changeValueRefs.includes("#/definitions/AuditLogPartialRole"));
    assert.ok(changeValueRefs.includes("#/definitions/AuditLogApplicationCommandPermissionValue"));
    assert.ok(changeValueRefs.includes("#/definitions/ChannelPermissionOverwrite"));
});

test("AuditLogChange validates scalar and partial-role values", () => {
    assert.equal(
        ajv.validate("AuditLogResponse", {
            application_commands: [],
            audit_log_entries: [
                {
                    id: "100",
                    action_type: 1,
                    changes: [
                        { key: "name", old_value: "old", new_value: "new" },
                        { key: "position", old_value: 1, new_value: 2 },
                        { key: "$add", new_value: [{ id: "123", name: "moderator" }] },
                        { key: "$remove", new_value: [{ id: "123", name: "moderator" }] },
                        {
                            key: "456",
                            old_value: { id: "456", type: 1, permission: true },
                            new_value: { id: "456", type: 1, permission: false },
                        },
                    ],
                },
            ],
            guild_scheduled_events: [],
            integrations: [],
            threads: [],
            users: [],
            webhooks: [],
            auto_moderation_rules: [],
        }),
        true,
    );
});

test("AuditLogChange rejects legacy nested role-change values", () => {
    assert.equal(
        ajv.validate("AuditLogResponse", {
            application_commands: [],
            audit_log_entries: [
                {
                    id: "100",
                    action_type: 1,
                    changes: [
                        {
                            key: "$add",
                            new_value: { $add: [{ id: "123", name: "moderator" }] },
                        },
                    ],
                },
            ],
            guild_scheduled_events: [],
            integrations: [],
            threads: [],
            users: [],
            webhooks: [],
            auto_moderation_rules: [],
        }),
        false,
    );
    assert.equal(
        ajv.validate("AuditLogResponse", {
            application_commands: [],
            audit_log_entries: [
                {
                    id: "100",
                    action_type: 1,
                    changes: [
                        {
                            key: "$remove",
                            new_value: [{ id: "123" }],
                        },
                    ],
                },
            ],
            guild_scheduled_events: [],
            integrations: [],
            threads: [],
            users: [],
            webhooks: [],
            auto_moderation_rules: [],
        }),
        false,
    );
});
