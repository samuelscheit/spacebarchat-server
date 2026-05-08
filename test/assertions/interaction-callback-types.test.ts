import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { InteractionCallbacksSchema, InteractionCallbackType } from "@spacebar/schemas";

type AcceptedInteractionCallbackType = InteractionCallbacksSchema["type"];
type AssertNever<T extends never> = T;
type IframeModalIsNotAccepted = AssertNever<Extract<AcceptedInteractionCallbackType, InteractionCallbackType.IFRAME_MODAL>>;

test("iframe modal callbacks stay outside the accepted callback schema until implemented", () => {
    const callbackTypeSource = readFileSync(join(process.cwd(), "src/schemas/api/bots/InteractionCallbackType.ts"), "utf8");
    assert.match(callbackTypeSource, /IFRAME_MODAL\s*=\s*11/);

    const callbackRoute = readFileSync(join(process.cwd(), "src/api/routes/interactions/#interaction_id/#interaction_token/callback.ts"), "utf8");
    const iframeModalCase = callbackRoute.match(/case InteractionCallbackType\.IFRAME_MODAL:[\s\S]*?case InteractionCallbackType\.LAUNCH_ACTIVITY:/);

    assert.ok(iframeModalCase, "Expected the inactive IFRAME_MODAL placeholder to stay grouped with unsupported callback variants");
    assert.equal(iframeModalCase[0].includes("TODO"), false, "IFRAME_MODAL is not accepted by InteractionCallbacksSchema, so it should not carry an implementation TODO");
});
