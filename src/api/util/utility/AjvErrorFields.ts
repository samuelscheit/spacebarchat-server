import type { ErrorObject } from "ajv";
import type { ErrorContent, ErrorList } from "@spacebar/util";

function decodeJsonPointerSegments(path: string) {
    if (!path) return [];

    return path
        .slice(1)
        .split("/")
        .filter(Boolean)
        .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function getFieldPathSegments(error: ErrorObject) {
    const path = decodeJsonPointerSegments(error.instancePath);
    if (error.keyword === "required" && typeof error.params?.missingProperty === "string") {
        return [...path, error.params.missingProperty];
    }

    if (error.keyword === "additionalProperties" && typeof error.params?.additionalProperty === "string") {
        return [...path, error.params.additionalProperty];
    }

    return path;
}

function getErrorCode(error: ErrorObject) {
    switch (error.keyword) {
        case "required":
            return "BASE_TYPE_REQUIRED";
        case "enum":
            return "BASE_TYPE_CHOICES";
        case "maxLength":
        case "minLength":
        case "maxItems":
        case "minItems":
            return "BASE_TYPE_BAD_LENGTH";
        case "type":
            return "BASE_TYPE_INVALID";
        default:
            return error.keyword || "BASE_TYPE_INVALID";
    }
}

function getErrorMessage(error: ErrorObject) {
    if (error.keyword === "required") return "This field is required";
    return error.message || "";
}

function appendError(errorList: ErrorList, path: string[], error: ErrorContent) {
    if (!path.length) {
        errorList._errors ??= [];
        errorList._errors.push(error);
        return;
    }

    const [currentPath, ...remainingPath] = path;
    if (!remainingPath.length) {
        const fieldError = errorList[currentPath];
        const fieldErrorList = Array.isArray(fieldError) || !fieldError ? {} : fieldError;
        fieldErrorList._errors ??= [];
        fieldErrorList._errors.push(error);
        errorList[currentPath] = fieldErrorList;
        return;
    }

    const childErrorList = errorList[currentPath];
    if (Array.isArray(childErrorList) || !childErrorList) {
        errorList[currentPath] = {};
    }

    appendError(errorList[currentPath] as ErrorList, remainingPath, error);
}

export function ajvErrorsToFieldErrors(errors: ErrorObject[] = []): ErrorList {
    const fields: ErrorList = {};

    for (const error of errors) {
        appendError(fields, getFieldPathSegments(error), {
            code: getErrorCode(error),
            message: getErrorMessage(error),
        });
    }

    return fields;
}
