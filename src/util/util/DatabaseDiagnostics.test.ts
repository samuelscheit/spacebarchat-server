import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { missingDatabaseEnvironmentMessage } from "./DatabaseDiagnostics";

describe("missingDatabaseEnvironmentMessage", () => {
    test("points localhost users at the required setup files and PostgreSQL", () => {
        const message = missingDatabaseEnvironmentMessage();

        assert.match(message, /DATABASE environment variable not set!/);
        assert.match(message, /PostgreSQL/);
        assert.match(message, /DATABASE=postgres:\/\/postgres@127\.0\.0\.1:5432\/spacebar/);
        assert.match(message, /\.env\.example/);
        assert.match(message, /config\.example\.json/);
        assert.match(message, /createdb -U postgres spacebar/);
        assert.match(message, /npm run build/);
        assert.match(message, /https:\/\/docs\.spacebar\.chat\/setup\/server\/installation\/generic\/database\//);
    });
});
