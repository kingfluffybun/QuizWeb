import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

// Load environment variables from .env.local if present
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
}

const isLocalhost = !process.env.DB_HOST || ["localhost", "127.0.0.1"].includes(process.env.DB_HOST);
const enableSsl = process.env.DB_SSL === "true" || (!isLocalhost && process.env.DB_SSL !== "false");

async function runMigrations() {
    console.log(`Connecting to database ${process.env.DB_NAME} at ${process.env.DB_HOST}...`);

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: enableSsl ? { rejectUnauthorized: true } : undefined,
        multipleStatements: true,
    });

    try {
        console.log("Connected successfully. Initializing migrations tracking table...");

        await connection.query(`
            CREATE TABLE IF NOT EXISTS _migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        const [rows] = await connection.query("SELECT name FROM _migrations");
        const appliedMigrations = new Set(rows.map((r) => r.name));

        const migrationsDir = path.resolve(process.cwd(), "migrations");
        const sqlFiles = fs
            .readdirSync(migrationsDir)
            .filter((file) => file.endsWith(".sql") && !file.includes("rollback"))
            .sort();

        for (const file of sqlFiles) {
            if (appliedMigrations.has(file)) {
                console.log(`[SKIPPED] ${file} (already applied)`);
                continue;
            }

            console.log(`[APPLYING] ${file}...`);
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, "utf8");

            await connection.query(sql);
            await connection.query("INSERT INTO _migrations (name) VALUES (?)", [file]);
            console.log(`[SUCCESS] Applied ${file}`);
        }

        console.log("All migrations executed successfully.");

        // Verification check on key columns
        console.log("\nVerifying database schema...");
        const [vrfyCols] = await connection.query("DESCRIBE user_vrfy_tbl");
        console.log("user_vrfy_tbl columns:", vrfyCols.map(c => c.Field).join(", "));

        const [authCols] = await connection.query("DESCRIBE user_auth_tbl");
        console.log("user_auth_tbl columns:", authCols.map(c => c.Field).join(", "));

        const [otpCols] = await connection.query("DESCRIBE user_otp_tbl");
        console.log("user_otp_tbl columns:", otpCols.map(c => c.Field).join(", "));

    } finally {
        await connection.end();
    }
}

runMigrations().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
