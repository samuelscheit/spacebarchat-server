import assert from "node:assert/strict";

export async function assertStatus(response: Response, expectedStatus: number) {
    assert.equal(response.status, expectedStatus);
}

export async function assertJsonObject(response: Response) {
    const body = await response.json();
    assert.equal(typeof body, "object");
    assert.notEqual(body, null);
    assert.ok(!Array.isArray(body));
    return body as Record<string, unknown>;
}

export async function assertJsonError(response: Response, expectedStatus: number) {
    await assertStatus(response, expectedStatus);
    const body = await assertJsonObject(response);
    assert.equal(typeof body.message, "string");
    return body;
}

export function assertHeader(response: Response, name: string) {
    const value = response.headers.get(name);
    assert.notEqual(value, null, `missing ${name} header`);
    return value;
}
