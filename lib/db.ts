import mysql from "mysql2/promise";

function parseEnvInt(raw: string | undefined, fallback: number, min = 0): number {
    if (raw === undefined || raw.trim() === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= min ? Math.trunc(parsed) : fallback;
}

const isLocalhost = !process.env.DB_HOST || ["localhost", "127.0.0.1"].includes(process.env.DB_HOST);
const enableSsl = process.env.DB_SSL === "true" || (!isLocalhost && process.env.DB_SSL !== "false");

const poolConfig: mysql.PoolOptions = {
    host: process.env.DB_HOST,
    port: parseEnvInt(process.env.DB_PORT, 3306, 1),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: enableSsl ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
    waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS !== "false",
    connectionLimit: parseEnvInt(process.env.DB_CONNECTION_LIMIT, 10, 1),
    queueLimit: parseEnvInt(process.env.DB_QUEUE_LIMIT, 0, 0),
    idleTimeout: parseEnvInt(process.env.DB_IDLE_TIMEOUT_MS, 60000, 1000),
    enableKeepAlive: true,
    keepAliveInitialDelay: parseEnvInt(process.env.DB_KEEPALIVE_DELAY_MS, 10000, 0),
    dateStrings: true,
};

const globalForDb = globalThis as unknown as { mysqlPool?: mysql.Pool };
export const db = globalForDb.mysqlPool ?? mysql.createPool(poolConfig);

globalForDb.mysqlPool = db;

export default db;
