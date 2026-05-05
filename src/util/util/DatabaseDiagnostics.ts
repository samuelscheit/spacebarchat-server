export function missingDatabaseEnvironmentMessage() {
    return [
        "DATABASE environment variable not set. Spacebar requires a PostgreSQL connection string.",
        "Example: DATABASE=postgres://postgres@127.0.0.1:5432/spacebar",
        "",
        "For a localhost development setup:",
        "1. Create a PostgreSQL database, for example: createdb -U postgres spacebar",
        "2. Copy .env.example to .env and adjust DATABASE for your local PostgreSQL user/password.",
        "3. Copy config.example.json to config.json, then adjust public endpoints as needed.",
        "4. Run npm run build before npm run start.",
        "",
        "Database setup: https://docs.spacebar.chat/setup/server/database/",
        "More details: https://docs.spacebar.chat/setup/server/configuration/env/",
    ].join("\n");
}
