import pg from "pg";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || "spendwise_db",
  user: process.env.PGUSER || "maryardientes",
  password: process.env.PGPASSWORD || undefined,
});

async function migrate() {
  console.log("🔄 SpendWise Database Migration Runner\n");

  // Ensure _migrations table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Get already-applied migrations
  const applied = await pool.query("SELECT name FROM _migrations ORDER BY id");
  const appliedSet = new Set(applied.rows.map((r) => r.name));

  // Read migration files
  const migrationsDir = path.resolve("migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ✓ ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    try {
      await pool.query("BEGIN");
      await pool.query(sql);
      await pool.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await pool.query("COMMIT");
      console.log(`  ✅ ${file} — applied successfully`);
      count++;
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error(`  ❌ ${file} — FAILED:`, err.message);
      process.exit(1);
    }
  }

  if (count === 0) {
    console.log("\n  All migrations are up to date.");
  } else {
    console.log(`\n  Applied ${count} migration(s).`);
  }

  await pool.end();
}

migrate();
