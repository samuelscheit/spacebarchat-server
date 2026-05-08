import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

function getPermissionOverwriteRouteSource() {
    return fs.readFileSync(path.join(process.cwd(), "src/api/routes/channels/#channel_id/permissions.ts"), "utf8");
}

describe("channel permission overwrite route behavior", () => {
    test("DELETE overwrite is gated by MANAGE_ROLES without role hierarchy enforcement", () => {
        const source = getPermissionOverwriteRouteSource();
        const deleteRouteStart = source.indexOf('router.delete("/:overwrite_id"');
        const exportStart = source.indexOf("export default router;");
        assert.notEqual(deleteRouteStart, -1);
        assert.notEqual(exportStart, -1);

        const deleteRoute = source.slice(deleteRouteStart, exportStart);

        assert.match(deleteRoute, /route\(\{\s*permission:\s*"MANAGE_ROLES"/);
        assert.doesNotMatch(deleteRoute, /hierarchy/i);
        assert.doesNotMatch(deleteRoute, /assertCanManage.*Hierarchy/);
    });
});
