import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runtimeModuleGlob } from "./Database";
import { getDatabaseType, getDatabaseUrl } from "./DatabaseConfig";

describe("Database startup validation", () => {
    it("does not validate DATABASE at import time", () => {
        assert.equal(typeof getDatabaseUrl, "function");
    });

    it("throws a clear error when DATABASE is missing", () => {
        const database = process.env.DATABASE;
        delete process.env.DATABASE;

        try {
            assert.throws(() => getDatabaseUrl(), /DATABASE environment variable not set!/);
        } finally {
            if (database != null) process.env.DATABASE = database;
        }
    });

    it("derives the database type from the connection string", () => {
        assert.equal(getDatabaseType("postgres://user:password@localhost:5432/database"), "postgres");
        assert.equal(getDatabaseType("mongodb+srv://localhost/database"), "mongodb");
    });

    it("excludes compiled test files from TypeORM runtime module globs", () => {
        assert.match(runtimeModuleGlob("/spacebar", "dist", "util", "entities"), /!\(\*\.test\|\*\.spec\)\.js$/);
    });
});
