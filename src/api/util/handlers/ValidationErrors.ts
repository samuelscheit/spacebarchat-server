import { ErrorObject } from "ajv";

export function getValidationErrorField(error: ErrorObject): string {
    const fieldPath = error.instancePath
        .slice(1)
        .split("/")
        .map((pathPart) => pathPart.replaceAll("~1", "/").replaceAll("~0", "~"))
        .join("/");

    if (error.keyword !== "required") return fieldPath;

    const missingProperty = typeof error.params.missingProperty === "string" ? error.params.missingProperty : "";
    return fieldPath ? `${fieldPath}/${missingProperty}` : missingProperty;
}
