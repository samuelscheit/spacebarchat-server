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
const schemas = JSON.parse(fs.readFileSync(SchemaPath, { encoding: "utf8" }).replaceAll("#/definitions/", ""));
normalizeAjvSchemaTypes(schemas);

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
        schemas: schemas,
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

function normalizeAjvSchemaTypes(schema: unknown) {
    if (!schema || typeof schema !== "object") return;

    const schemaRecord = schema as Record<string, unknown>;
    if (schemaRecord.type === "bigint") {
        delete schemaRecord.type;
        schemaRecord.anyOf = [{ type: "integer" }, { type: "string", pattern: "^-?[0-9]+$" }];
    }

    for (const value of Object.values(schemaRecord)) {
        normalizeAjvSchemaTypes(value);
    }
}

export const ajv = createAjv(true);
export const nonCoercingAjv = createAjv(false);

export function validateSchema<G extends object>(schema: string, data: G): G {
    const valid = ajv.validate(schema, data);
    if (!valid) {
        console.log("[Validator] Validation error in ", schema);
        throw ajv.errors;
    }
    return data;
}
