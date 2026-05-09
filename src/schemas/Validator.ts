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

const SchemaPath = resolveSchemaPath();
const sourceSchemas = JSON.parse(fs.readFileSync(SchemaPath, { encoding: "utf8" }).replaceAll("#/definitions/", "")) as Record<string, unknown>;
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

function coerceBigIntFields(schema: unknown, value: unknown): unknown {
    const schemaRecord = getSchemaRecord(schema);
    if (!schemaRecord) return value;

    const referencedSchema = resolveSchemaReference(schemaRecord.$ref);
    if (referencedSchema) return coerceBigIntFields(referencedSchema, value);

    if (isBigIntSchema(schemaRecord)) return coerceBigIntValue(value);

    for (const key of ["allOf", "anyOf", "oneOf"]) {
        const subSchemas = schemaRecord[key];
        if (!Array.isArray(subSchemas)) continue;

        for (const subSchema of subSchemas) {
            const coerced = coerceBigIntFields(subSchema, value);
            if (coerced !== value) return coerced;
        }
    }

    const items = schemaRecord.items;
    if (Array.isArray(value)) {
        if (Array.isArray(items)) {
            for (const [index, itemSchema] of items.entries()) {
                value[index] = coerceBigIntFields(itemSchema, value[index]);
            }
        } else if (items) {
            for (const [index, item] of value.entries()) {
                value[index] = coerceBigIntFields(items, item);
            }
        }
        return value;
    }

    const properties = getSchemaMap(schemaRecord.properties);
    if (!value || typeof value !== "object" || !properties) return value;

    const objectValue = value as Record<string, unknown>;
    for (const [key, propertySchema] of Object.entries(properties)) {
        if (key in objectValue) objectValue[key] = coerceBigIntFields(propertySchema, objectValue[key]);
    }

    return value;
}

function resolveSchemaReference(ref: unknown): unknown {
    if (typeof ref !== "string") return undefined;

    const schemaName = ref.replace(/^#\/definitions\//, "");
    return sourceSchemas[schemaName];
}

function isBigIntSchema(schema: Record<string, unknown>) {
    const { type, pattern } = schema;

    return (
        type === "bigint" ||
        (Array.isArray(type) && type.includes("bigint")) ||
        (Array.isArray(type) && type.includes("integer") && type.includes("string") && pattern === "^-?[0-9]+$")
    );
}

function getSchemaRecord(schema: unknown): Record<string, unknown> | undefined {
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) return undefined;
    return schema as Record<string, unknown>;
}

function getSchemaMap(schema: unknown): Record<string, unknown> | undefined {
    return getSchemaRecord(schema);
}

function coerceBigIntValue(value: unknown) {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
    if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value);
    return value;
}
