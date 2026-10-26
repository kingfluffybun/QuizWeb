import mysql from "mysql2/promise";

const isLocalhost = !process.env.DB_HOST || ["localhost", "127.0.0.1"].includes(process.env.DB_HOST);
const enableSsl = process.env.DB_SSL === "true" || (!isLocalhost && process.env.DB_SSL !== "false");

const poolConfig: mysql.PoolOptions = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: enableSsl ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
    waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS !== "false",
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
    queueLimit: Number(process.env.DB_QUEUE_LIMIT ?? 0),
    idleTimeout: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 60000),
    enableKeepAlive: true,
    keepAliveInitialDelay: Number(process.env.DB_KEEPALIVE_DELAY_MS ?? 10000),
    dateStrings: true,
};

const globalForDb = globalThis as unknown as { mysqlPool?: mysql.Pool };
export const db = globalForDb.mysqlPool ?? mysql.createPool(poolConfig);

globalForDb.mysqlPool = db;

export default db;
