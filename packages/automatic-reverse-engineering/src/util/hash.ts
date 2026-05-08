import { createHash } from "node:crypto";

import { stableStringify } from "./json.js";

export function sha256(data: string | Uint8Array | ArrayBuffer): string {
    const hash = createHash("sha256");
    if (data instanceof ArrayBuffer) {
        hash.update(new Uint8Array(data));
    } else {
        hash.update(data);
    }

    return `sha256:${hash.digest("hex")}`;
}

export function hashJson(value: unknown): string {
    return sha256(stableStringify(value));
}
