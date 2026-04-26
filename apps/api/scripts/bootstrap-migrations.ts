/**
 * One-time bootstrap: seed drizzle-kit's __drizzle_migrations table
 * with records for migrations that were applied outside of drizzle-kit
 * (i.e., during the initial database bootstrap before Railway's
 * preDeployCommand was correctly configured).
 *
 * Safe to run repeatedly: each dialect has a *sentinel* data table
 * that the listed "already applied" migrations create (`users` for
 * MySQL, `events` for Postgres). The script only seeds the tracker
 * when the sentinel table actually exists — i.e. the schema really
 * was bootstrapped out-of-band on this database.
 *
 * On a freshly provisioned database the sentinel is absent, so we
 * deliberately leave `__drizzle_migrations` empty and let
 * `drizzle-kit migrate` apply every migration from scratch. Without
 * this guard, seeding the tracker on a fresh DB would convince
 * drizzle-kit that the schema-creating migrations had already been
 * applied; it would skip them and the deployment would come up with
 * zero tables — surfacing as `provider_error` at OAuth callback time
 * because `oauth_transactions` (and every other core table) would be
 * missing.
 *
 * If a previous run of this script (before the sentinel guard
 * existed) poisoned the tracker on a fresh database, we detect that
 * state — tracker rows present but the sentinel table absent — and
 * clear the bogus rows so the next `drizzle-kit migrate` can recover.
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

/**
 * Sentinel table created by the *first* migration in
 * {@link MYSQL_ALREADY_APPLIED}. Used as proof that the schema really
 * was bootstrapped out-of-band on this database. If absent we treat
 * the database as fresh and refuse to seed the tracker.
 */
const MYSQL_SENTINEL_TABLE = "users";

const PG_ALREADY_APPLIED = [
  "0000_parallel_valeria_richards",
];

/** See {@link MYSQL_SENTINEL_TABLE}. Created by the first PG migration. */
const PG_SENTINEL_TABLE = "events";

async function bootstrapMySQL() {
  const url = process.env.MYSQL_URL;
  if (!url) {
    console.log("[bootstrap] MYSQL_URL not set — skipping MySQL bootstrap");
    return;
  }

  const conn = await mysql.createConnection(url);
  try {
    const [sentinelRows] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = ?`,
      [MYSQL_SENTINEL_TABLE]
    ) as any;
    const sentinelExists = Number(sentinelRows[0].cnt) > 0;

    const [trackerRows] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = '__drizzle_migrations'`
    ) as any;
    const trackerExists = Number(trackerRows[0].cnt) > 0;

    // Fresh database (or recovery from a previous broken bootstrap):
    // the sentinel table the listed migrations would have created is
    // not present. Seeding the tracker now would lie to drizzle-kit
    // and skip the very migrations that build the core schema, so
    // refuse to seed. If a prior run already poisoned the tracker,
    // wipe the bogus rows so the next `drizzle-kit migrate` can
    // recover.
    if (!sentinelExists) {
      if (trackerExists) {
        const [migRows] = await conn.query(
          `SELECT COUNT(*) AS cnt FROM __drizzle_migrations`
        ) as any;
        if (Number(migRows[0].cnt) > 0) {
          console.log(
            `[bootstrap] MySQL: __drizzle_migrations has entries but sentinel table \`${MYSQL_SENTINEL_TABLE}\` is missing — clearing poisoned tracker so drizzle-kit can re-apply all migrations from scratch`
          );
          await conn.query(`DELETE FROM __drizzle_migrations`);
        }
      }
      console.log(
        `[bootstrap] MySQL: fresh database detected (sentinel \`${MYSQL_SENTINEL_TABLE}\` table absent) — leaving tracker empty so drizzle-kit applies all migrations`
      );
      return;
    }

    if (trackerExists) {
      const [migRows] = await conn.query(`SELECT COUNT(*) AS cnt FROM __drizzle_migrations`) as any;
      if (Number(migRows[0].cnt) > 0) {
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
    const sentinelCheck = await client.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1`,
      [PG_SENTINEL_TABLE]
    );
    const sentinelExists = parseInt(sentinelCheck.rows[0].cnt) > 0;

    const tableCheck = await client.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables
        WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'`
    );
    const trackerExists = parseInt(tableCheck.rows[0].cnt) > 0;

    // See bootstrapMySQL: refuse to seed on a fresh database, and
    // recover from a previously poisoned tracker.
    if (!sentinelExists) {
      if (trackerExists) {
        const migCheck = await client.query(`SELECT COUNT(*) AS cnt FROM drizzle.__drizzle_migrations`);
        if (parseInt(migCheck.rows[0].cnt) > 0) {
          console.log(
            `[bootstrap] Postgres: drizzle.__drizzle_migrations has entries but sentinel table \`${PG_SENTINEL_TABLE}\` is missing — clearing poisoned tracker so drizzle-kit can re-apply all migrations from scratch`
          );
          await client.query(`DELETE FROM drizzle.__drizzle_migrations`);
        }
      }
      console.log(
        `[bootstrap] Postgres: fresh database detected (sentinel \`${PG_SENTINEL_TABLE}\` table absent) — leaving tracker empty so drizzle-kit applies all migrations`
      );
      return;
    }

    if (trackerExists) {
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
