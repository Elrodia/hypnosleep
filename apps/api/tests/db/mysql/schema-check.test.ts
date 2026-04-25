import { describe, expect, it } from 'vitest';
import {
  detectMissingCoreTables,
  REQUIRED_MYSQL_TABLES,
  type SchemaProbe,
} from '@/db/mysql/schema-check';

function probeWith(present: readonly string[]): SchemaProbe {
  return {
    listTables: async () => new Set(present),
  };
}

describe('detectMissingCoreTables', () => {
  it('returns no issues when every required table is present', async () => {
    const probe = probeWith([...REQUIRED_MYSQL_TABLES]);
    expect(await detectMissingCoreTables(probe)).toEqual([]);
  });

  it('returns no issues when extra non-core tables are also present', async () => {
    // Freshly-migrated DBs contain bookkeeping tables like
    // `__drizzle_migrations` that the check should ignore. Missing from
    // the required list ≠ forbidden.
    const probe = probeWith([
      ...REQUIRED_MYSQL_TABLES,
      '__drizzle_migrations',
      'some_future_feature_table',
    ]);
    expect(await detectMissingCoreTables(probe)).toEqual([]);
  });

  it('flags oauth_transactions specifically when it is the only missing table', async () => {
    const probe = probeWith(
      REQUIRED_MYSQL_TABLES.filter((t) => t !== 'oauth_transactions'),
    );
    const missing = await detectMissingCoreTables(probe);
    expect(missing).toHaveLength(1);
    expect(missing[0]).toEqual(
      expect.objectContaining({ table: 'oauth_transactions' }),
    );
    expect(missing[0]?.hint).toMatch(/migrations/i);
  });

  it('flags every required table when the database is empty', async () => {
    const probe = probeWith([]);
    const missing = await detectMissingCoreTables(probe);
    expect(missing.map((m) => m.table).sort()).toEqual([...REQUIRED_MYSQL_TABLES].sort());
  });

  it('does not swallow probe failures — they must propagate to the caller', async () => {
    const probe: SchemaProbe = {
      listTables: async () => {
        throw new Error('connection refused');
      },
    };
    // Deliberately not caught inside `detectMissingCoreTables`: the
    // caller must distinguish "schema is wrong" from "can't reach the
    // DB at all" and log them differently.
    await expect(detectMissingCoreTables(probe)).rejects.toThrow(/connection refused/);
  });
});
