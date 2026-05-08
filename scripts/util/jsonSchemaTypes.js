const JSON_SCHEMA_TYPES = new Set(["array", "boolean", "integer", "null", "number", "object", "string"]);

function normalizeType(type) {
    if (type === "bigint") return "integer";

    if (!Array.isArray(type)) return type;

    const normalized = type.map((value) => (value === "bigint" ? "integer" : value));
    return [...new Set(normalized)];
}

function isTypescriptJsonSchemaBigIntFallback(schema) {
    return schema.type === "number" && schema.additionalProperties === false && schema.properties && Object.keys(schema.properties).length === 0;
}

function normalizeGeneratedJsonSchemaTypes(schema) {
    if (!schema || typeof schema !== "object") return schema;

    if (Object.prototype.hasOwnProperty.call(schema, "type")) {
        schema.type = normalizeType(schema.type);
    }

    // typescript-json-schema has emitted BigInt fields both as `type: "bigint"`
    // and as a number schema polluted with object-only keywords. JSON payloads
    // represent BigInt values as integer numbers, so keep the generated assets
    // draft-07-compatible by normalizing both forms to JSON Schema `integer`.
    if (isTypescriptJsonSchemaBigIntFallback(schema)) {
        schema.type = "integer";
        delete schema.properties;
        delete schema.additionalProperties;
    }

    for (const value of Object.values(schema)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                normalizeGeneratedJsonSchemaTypes(item);
            }
        } else {
            normalizeGeneratedJsonSchemaTypes(value);
        }
    }

    return schema;
}

function findInvalidJsonSchemaTypes(schema, path = "$", invalidTypes = []) {
    if (!schema || typeof schema !== "object") return invalidTypes;

    const { type } = schema;
    const types = Array.isArray(type) ? type : typeof type === "string" ? [type] : [];

    for (const value of types) {
        if (!JSON_SCHEMA_TYPES.has(value)) {
            invalidTypes.push({ path, type: value });
        }
    }

    for (const [key, value] of Object.entries(schema)) {
        if (Array.isArray(value)) {
            value.forEach((item, index) => findInvalidJsonSchemaTypes(item, `${path}.${key}[${index}]`, invalidTypes));
        } else {
            findInvalidJsonSchemaTypes(value, `${path}.${key}`, invalidTypes);
        }
    }

    return invalidTypes;
}

module.exports = {
    findInvalidJsonSchemaTypes,
    normalizeGeneratedJsonSchemaTypes,
};
