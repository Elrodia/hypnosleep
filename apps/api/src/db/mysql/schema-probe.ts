import { sql } from 'drizzle-orm';
import { mysqlDb } from './client.js';
import type { SchemaProbe } from './schema-check.js';

/**
 * Production {@link SchemaProbe} backed by the live MySQL connection.
 *
 * Uses `information_schema.tables` scoped to the current database
 * (`DATABASE()`) so the query is correct no matter how the connection
 * was configured — the alternative (`SHOW TABLES LIKE`) would require
 * one roundtrip per table and wouldn't necessarily match names that
 * contain special characters.
 *
 * Kept in its own module (separate from {@link SchemaProbe} and
 * {@link detectMissingCoreTables}) so the pure helper can be unit-tested
 * without booting the live MySQL pool — importing the client transitively
 * runs `env` validation, which would force every test to ship a full
 * `Env` fixture even if it never touches MySQL.
 */
export const mysqlSchemaProbe: SchemaProbe = {
  async listTables() {
    // `drizzle(pool, { mode: 'default' })` + mysql2 makes `.execute()`
    // resolve to `[rows, fields]`, but if that ever changes upstream
    // (or the driver is swapped) we still want to degrade to "no info"
    // rather than crash the boot path — this helper is a safety net,
    // so it must never itself become a startup failure.
    const result = (await mysqlDb.execute(
      sql`SELECT TABLE_NAME AS table_name FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE()`,
    )) as unknown;

    const rows = Array.isArray(result)
      ? Array.isArray(result[0])
        ? (result[0] as unknown[])
        : (result as unknown[])
      : [];

    const names = new Set<string>();
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const r = row as { table_name?: unknown; TABLE_NAME?: unknown };
      // MySQL returns the column name in its declared case, but some
      // drivers/configs lower-case it. Accept both.
      const raw =
        typeof r.table_name === 'string'
          ? r.table_name
          : typeof r.TABLE_NAME === 'string'
            ? r.TABLE_NAME
            : null;
      if (raw) names.add(raw);
    }
    return names;
  },
};
