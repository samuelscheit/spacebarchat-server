type PgClient = {
    connect(): Promise<void>;
    query(sql: string, values?: unknown[]): Promise<unknown>;
    end(): Promise<void>;
};

type PgClientConstructor = new (options: { connectionString: string }) => PgClient;

const { Client } = require("pg") as { Client: PgClientConstructor };

export interface DisposablePostgresDatabase {
    adminUrl: string;
    name: string;
    url: string;
    close(): Promise<void>;
}

export interface DisposablePostgresOptions {
    adminUrl?: string;
    prefix?: string;
}

export function getPostgresAdminUrl(options: DisposablePostgresOptions = {}) {
    return options.adminUrl ?? process.env.TEST_DATABASE_ADMIN_URL ?? process.env.DATABASE;
}

export function hasPostgresAdminUrl(options: DisposablePostgresOptions = {}) {
    return Boolean(getPostgresAdminUrl(options));
}

export async function createDisposablePostgresDatabase(options: DisposablePostgresOptions = {}): Promise<DisposablePostgresDatabase> {
    const adminUrl = getPostgresAdminUrl(options);
    if (!adminUrl) throw new Error("TEST_DATABASE_ADMIN_URL or DATABASE must be set to create a disposable Postgres database");

    const name = createDatabaseName(options.prefix);
    const databaseUrl = withDatabaseName(adminUrl, name);
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();

    let closed = false;
    try {
        await admin.query(`CREATE DATABASE ${quoteIdentifier(name)}`);
    } catch (error) {
        await admin.end();
        throw error;
    }

    return {
        adminUrl,
        name,
        url: databaseUrl,
        async close() {
            if (closed) return;
            closed = true;

            await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [name]);
            await admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(name)}`);
            await admin.end();
        },
    };
}

export async function withDisposablePostgresDatabase<T>(fn: (database: DisposablePostgresDatabase) => T | Promise<T>, options: DisposablePostgresOptions = {}): Promise<T> {
    const database = await createDisposablePostgresDatabase(options);
    try {
        return await fn(database);
    } finally {
        await database.close();
    }
}

function createDatabaseName(prefix = "spacebar_test") {
    const safePrefix = prefix
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/^[^a-z_]+/, "db_");
    const suffix = `${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return `${safePrefix}_${suffix}`.slice(0, 63);
}

function withDatabaseName(connectionString: string, databaseName: string) {
    const url = new URL(connectionString);
    url.pathname = `/${databaseName}`;
    return url.toString();
}

function quoteIdentifier(identifier: string) {
    if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) throw new Error(`Invalid Postgres identifier: ${identifier}`);
    return `"${identifier.replace(/"/g, '""')}"`;
}
