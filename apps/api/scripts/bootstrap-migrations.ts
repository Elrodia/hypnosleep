/**
 * One-time bootstrap: seed drizzle-kit's __drizzle_migrations table
 * with records for migrations that were applied outside of drizzle-kit
 * (i.e., during the initial database bootstrap before Railway's
 * preDeployCommand was correctly configured).
 *
 * Safe to run repeatedly — it no-ops if the tracking table already
 * has entries.
 *
 * Usage: npx tsx scripts/bootstrap-migrations.ts
 */

import mysql from "mysql2/promise";
import pg from "pg";

const MYSQL_ALREADY_APPLIED = [
  "0000_slippery_tusk",
  "0001_new_thunderbolts",
  "0002_seed_templates",
];

const PG_ALREADY_APPLIED = [
  "0000_parallel_valeria_richards",
];

async function bootstrapMySQL() {
  const url = process.env.MYSQL_URL;
  if (!url) {
    console.log("[bootstrap] MYSQL_URL not set — skipping MySQL bootstrap");
    return;
  }

  const conn = await mysql.createConnection(url);
  try {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '__drizzle_migrations'`
    ) as any;

    if (rows[0].cnt > 0) {
      const [migRows] = await conn.query(`SELECT COUNT(*) AS cnt FROM __drizzle_migrations`) as any;
      if (migRows[0].cnt > 0) {
        console.log("[bootstrap] MySQL __drizzle_migrations already has entries — skipping");
        return;
      }
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT
      )
    `);

    const now = Date.now();
    for (const hash of MYSQL_ALREADY_APPLIED) {
      await conn.query(
        `INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)`,
        [hash, now]
      );
    }

    console.log(`[bootstrap] MySQL: seeded ${MYSQL_ALREADY_APPLIED.length} migration records`);
  } finally {
    await conn.end();
  }
}

async function bootstrapPostgres() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[bootstrap] DATABASE_URL not set — skipping Postgres bootstrap");
    return;
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const tableCheck = await client.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'`
    );

    if (parseInt(tableCheck.rows[0].cnt) > 0) {
      const migCheck = await client.query(`SELECT COUNT(*) AS cnt FROM drizzle.__drizzle_migrations`);
      if (parseInt(migCheck.rows[0].cnt) > 0) {
        console.log("[bootstrap] Postgres __drizzle_migrations already has entries — skipping");
        return;
      }
    }

    await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT
      )
    `);

    const now = Date.now();
    for (const hash of PG_ALREADY_APPLIED) {
      await client.query(
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
        [hash, now]
      );
    }

    console.log(`[bootstrap] Postgres: seeded ${PG_ALREADY_APPLIED.length} migration records`);
  } finally {
    await client.end();
  }
}

async function main() {
  console.log("[bootstrap] Checking if drizzle migration tracking tables need seeding...");
  await bootstrapMySQL();
  await bootstrapPostgres();
  console.log("[bootstrap] Done");
}

main().catch((err) => {
  console.error("[bootstrap] Fatal error:", err);
  process.exit(1);
});
