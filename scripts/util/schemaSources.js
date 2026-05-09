const path = require("path");

function isGeneratedSchemaSource(file) {
    const normalized = file.split(path.sep).join("/");

    return normalized.endsWith(".ts") && !normalized.endsWith(".test.ts") && !normalized.includes("/__tests__/");
}

function getGeneratedSchemaSources(schemaRoot, walk) {
    return walk(schemaRoot).filter(isGeneratedSchemaSource);
}

module.exports = {
    getGeneratedSchemaSources,
    isGeneratedSchemaSource,
};
