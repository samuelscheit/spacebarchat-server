export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonPrimitive = string | JsonNumber | boolean | null;

/**
 * @TJS-type number
 */
export type JsonNumber = number;

export interface JsonObject {
    [key: string]: JsonValue;
}
