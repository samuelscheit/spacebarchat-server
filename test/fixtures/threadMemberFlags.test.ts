import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { ThreadMemberFlags as PublicThreadMemberFlags } from "@spacebar/util";
import { ThreadMemberFlags as EntityThreadMemberFlags } from "@spacebar/util/entities/ThreadMember";
import { ThreadMemberFlags } from "@spacebar/util/util/ThreadMemberFlags";

test("ThreadMemberFlags keeps Discord thread notification bit values stable", () => {
    assert.equal(ThreadMemberFlags.NONE, 0);
    assert.equal(ThreadMemberFlags.HAS_INTERACTED, 1);
    assert.equal(ThreadMemberFlags.ALL_MESSAGES, 2);
    assert.equal(ThreadMemberFlags.ONLY_MENTIONS, 4);
    assert.equal(ThreadMemberFlags.NO_MESSAGES, 8);
});

test("ThreadMemberFlags is still re-exported from compatibility surfaces", () => {
    assert.equal(EntityThreadMemberFlags.ALL_MESSAGES, ThreadMemberFlags.ALL_MESSAGES);
    assert.equal(PublicThreadMemberFlags.NO_MESSAGES, ThreadMemberFlags.NO_MESSAGES);
});

test("ThreadMemberFlags can be imported without loading the ThreadMember entity module", () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const script = `
        const flagsPath = require.resolve("@spacebar/util/util/ThreadMemberFlags");
        const entityPath = require.resolve("./dist/util/entities/ThreadMember.js");
        const typeormPath = require.resolve("typeorm");
        require(flagsPath);
        process.stdout.write(JSON.stringify({
            entityLoaded: Object.hasOwn(require.cache, entityPath),
            typeormLoaded: Object.hasOwn(require.cache, typeormPath),
        }));
    `;

    const loadedModules = JSON.parse(
        execFileSync(process.execPath, ["-r", "module-alias/register", "-e", script], {
            cwd: repoRoot,
            encoding: "utf8",
        }),
    ) as { entityLoaded: boolean; typeormLoaded: boolean };

    assert.deepEqual(loadedModules, {
        entityLoaded: false,
        typeormLoaded: false,
    });
});
