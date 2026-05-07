import type { MessageType } from "@protobuf-ts/runtime";
import type { JsonObject } from "@spacebar/schemas";
import { HTTPError } from "lambert-server";

export function parseSettingsProtoJson<T extends object>(type: MessageType<T>, settings: JsonObject): T {
    try {
        return type.fromJson(settings);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new HTTPError(`Invalid settings proto JSON: ${message}`, 400);
    }
}
