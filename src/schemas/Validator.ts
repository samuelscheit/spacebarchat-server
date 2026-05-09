/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
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

import Ajv from "ajv";
import addFormats from "ajv-formats";
import fs from "node:fs";
import path from "node:path";
import { ImageDataUriFormat, ImageDataUriOrAssetHashFormat, isImageDataUri, isImageDataUriOrAssetHash } from "./ImageData";

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    pattern?: string;
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema | JsonSchema[];
    anyOf?: JsonSchema[];
    oneOf?: JsonSchema[];
    allOf?: JsonSchema[];
};

const SchemaPath = resolveSchemaPath();
const sourceSchemas = JSON.parse(fs.readFileSync(SchemaPath, { encoding: "utf8" }).replaceAll("#/definitions/", "")) as Record<string, JsonSchema>;
const schemas = normalizeBigIntSchemas(sourceSchemas) as Record<string, object>;

// const schemas2 = {...schemas, definitions: {...schemas, }};
// console.log(schemas);
// for (const schemaName in schemas) {
// 	const schema = schemas[schemaName];
// 	if ("x-sb-defs" in schema) {
// 		console.log("[Validator] Adding definitions for schema", schemaName, ":", schema["x-sb-defs"]);
// 		for (const defKey of schema["x-sb-defs"]) {
// 			console.log(" - ", defKey, typeof schemas[defKey] === "object");
// 			schema.definitions = schema.definitions || {};
// 			if (schemas[defKey]) schema.definitions[defKey] = schemas[defKey];
// 			else console.warn("[Validator] Definition", defKey, "not found for schema", schemaName);
// 		}
// 	}
// }

function createAjv(coerceTypes: boolean) {
    const validator = new Ajv({
        allErrors: true,
        parseDate: true,
        allowDate: true,
        schemas: schemas as Record<string, object>,
        coerceTypes,
        messages: true,
        strict: true,
        strictRequired: true,
        allowUnionTypes: true,
    });

    addFormats(validator);
    validator.addFormat(ImageDataUriFormat, {
        type: "string",
        validate: isImageDataUri,
    });
    validator.addFormat(ImageDataUriOrAssetHashFormat, {
        type: "string",
        validate: isImageDataUriOrAssetHash,
    });

    return validator;
}

function resolveSchemaPath() {
    const builtAssetPath = path.join(__dirname, "..", "..", "assets", "schemas.json");
    if (fs.existsSync(builtAssetPath)) return builtAssetPath;
    return path.join(process.cwd(), "assets", "schemas.json");
}

export const ajv = createAjv(true);
export const nonCoercingAjv = createAjv(false);

export function validateSchema<G extends object>(schema: string, data: G): G {
    const valid = ajv.validate(schema, data);
    if (!valid) {
        console.log("[Validator] Validation error in ", schema);
        throw ajv.errors;
    }
    coerceBigIntFields(sourceSchemas[schema], data);
    return data;
}

function normalizeBigIntSchemas(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => normalizeBigIntSchemas(item));
    if (!value || typeof value !== "object") return value;

    const objectValue = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(objectValue)) {
        normalized[key] = normalizeBigIntSchemas(entry);
    }

    if (normalized.type === "bigint") {
        delete normalized.type;
        normalized.anyOf = [{ type: "string", pattern: "^-?\\d+$" }, { type: "integer" }];
    } else if (Array.isArray(normalized.type) && normalized.type.includes("bigint")) {
        const remainingTypes = normalized.type.filter((type) => type !== "bigint");
        if (remainingTypes.length > 0) normalized.type = remainingTypes;
        else delete normalized.type;
        normalized.anyOf = [...((normalized.anyOf as unknown[] | undefined) ?? []), { type: "string", pattern: "^-?\\d+$" }, { type: "integer" }];
    }

    return normalized;
}

function coerceBigIntFields(schema: JsonSchema | undefined, value: unknown): unknown {
    if (!schema) return value;

    const referencedSchema = resolveSchemaReference(schema.$ref);
    if (referencedSchema) return coerceBigIntFields(referencedSchema, value);

    if (isBigIntSchema(schema)) return coerceBigIntValue(value);

    for (const subSchema of [...(schema.allOf ?? []), ...(schema.anyOf ?? []), ...(schema.oneOf ?? [])]) {
        coerceBigIntFields(subSchema, value);
    }

    if (Array.isArray(value)) {
        if (Array.isArray(schema.items)) {
            for (const [index, itemSchema] of schema.items.entries()) {
                value[index] = coerceBigIntFields(itemSchema, value[index]);
            }
        } else if (schema.items) {
            for (const [index, item] of value.entries()) {
                value[index] = coerceBigIntFields(schema.items, item);
            }
        }
        return value;
    }

    if (!value || typeof value !== "object" || !schema.properties) return value;

    const objectValue = value as Record<string, unknown>;
    for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (key in objectValue) objectValue[key] = coerceBigIntFields(propertySchema, objectValue[key]);
    }

    return value;
}

function resolveSchemaReference(ref: string | undefined): JsonSchema | undefined {
    if (!ref) return undefined;

    const schemaName = ref.replace(/^#\/definitions\//, "");
    return sourceSchemas[schemaName] as JsonSchema | undefined;
}

function isBigIntSchema(schema: JsonSchema) {
    return (
        schema.type === "bigint" ||
        (Array.isArray(schema.type) && schema.type.includes("bigint")) ||
        (Array.isArray(schema.type) && schema.type.includes("integer") && schema.type.includes("string") && schema.pattern === "^-?[0-9]+$")
    );
}

function coerceBigIntValue(value: unknown) {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
    if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value);
    return value;
}
