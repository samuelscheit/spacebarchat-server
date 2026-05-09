import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const reportingRouteSourcePath = path.join(process.cwd(), "src", "api", "routes", "reporting", "index.ts");

test("reporting route does not rely on stale unused-symbol suppression", async () => {
    const source = await fs.readFile(reportingRouteSourcePath, "utf8");
    const staleSuppression = ["//", "noinspection", "JSUnusedLocalSymbols", "-", "TODO:", "implement"].join(" ");
    const postHandlerWithUnusedResponse =
        /router\.post\([\s\S]*?\(req: Request,\s*res: Response\)\s*=>\s*\{\s*\/\/ TODO: implement\s*const body = req\.body as CreateReportSchema;/;

    assert.equal(source.includes(staleSuppression), false);
    assert.equal(postHandlerWithUnusedResponse.test(source), false);
});
