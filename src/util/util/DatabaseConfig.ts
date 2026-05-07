import { missingDatabaseEnvironmentMessage } from "./DatabaseDiagnostics";

export const getDatabaseUrl = () => {
    if (process.env.DATABASE) return process.env.DATABASE;

    throw new Error(missingDatabaseEnvironmentMessage());
};

export const getDatabaseType = (databaseUrl: string = getDatabaseUrl()) => databaseUrl.split(":")[0]?.replace("+srv", "");
