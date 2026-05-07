function isOpenApi31OrNewer(openapiVersion) {
    const [major, minor] = openapiVersion.split(".").map((part) => Number.parseInt(part, 10));
    return major > 3 || (major === 3 && minor >= 1);
}

function normalizeNullableTypes(schema, openapiVersion) {
    if (!schema || typeof schema !== "object") return schema;

    if (!isOpenApi31OrNewer(openapiVersion) && Array.isArray(schema.type) && schema.type.includes("null")) {
        const nonNullTypes = schema.type.filter((type) => type !== "null");
        schema.type = nonNullTypes.length === 1 ? nonNullTypes[0] : nonNullTypes;
        schema.nullable = true;
    }

    for (const value of Object.values(schema)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                normalizeNullableTypes(item, openapiVersion);
            }
        } else {
            normalizeNullableTypes(value, openapiVersion);
        }
    }

    return schema;
}

module.exports = {
    normalizeNullableTypes,
};
