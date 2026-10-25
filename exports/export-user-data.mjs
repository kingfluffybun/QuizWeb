import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
}

const isLocalhost = !process.env.DB_HOST || ["localhost", "127.0.0.1"].includes(process.env.DB_HOST);
const enableSsl = process.env.DB_SSL === "true" || (!isLocalhost && process.env.DB_SSL !== "false");

function getFormattedTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

async function exportUserData() {
    console.log(`Connecting to database ${process.env.DB_NAME} at ${process.env.DB_HOST}...`);

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: enableSsl ? { rejectUnauthorized: true } : undefined,
    });

    const userTables = [
        "user_auth_tbl",
        "player_tbl",
        "user_oauth_tbl",
        "user_vrfy_tbl",
        "user_otp_tbl",
        "rate_limit_tbl",
        "user_activity_tbl"
    ];

    try {
        console.log("Connected successfully. Exporting 1:1 user table records...");

        const exportData = {
            exported_at: new Date().toISOString(),
            source_database: process.env.DB_NAME,
            tables: {}
        };

        for (const tbl of userTables) {
            const [rows] = await connection.query(`SELECT * FROM \`${tbl}\``);
            exportData.tables[tbl] = rows;
            console.log(` - ${tbl}: ${rows.length} rows`);
        }

        const exportDir = path.resolve(process.cwd(), "exports");
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        const timestamp = getFormattedTimestamp();
        const exportFileName = `quizweb-user-data-${timestamp}.json`;
        const exportFilePath = path.join(exportDir, exportFileName);
        const latestFilePath = path.join(exportDir, "quizweb-user-data-latest.json");

        const jsonString = JSON.stringify(exportData, null, 2);

        fs.writeFileSync(exportFilePath, jsonString, "utf8");
        fs.writeFileSync(latestFilePath, jsonString, "utf8");

        console.log(`\nSuccessfully exported 1:1 user data to:`);
        console.log(` - ${exportFilePath}`);
        console.log(` - ${latestFilePath}`);

    } finally {
        await connection.end();
    }
}

exportUserData().catch((err) => {
    console.error("Export user data failed:", err);
    process.exit(1);
});
