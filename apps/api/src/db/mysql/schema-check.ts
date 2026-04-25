/**
 * MySQL tables that every deployment MUST have for the core product
 * flow to function. If any of these are missing, the cause is almost
 * always "the release-time migration step didn't run" — we've observed
 * this happen silently on Railway (release command not picked up, or
 * failed without failing the deploy), turning into a generic
 * `provider_error` at OAuth callback time with no upstream signal.
 *
 * Keep this list in sync with what the SQL migrations under
 * `src/db/mysql/migrations` produce — specifically the `CREATE TABLE`
 * statements that are still in effect (i.e. not later dropped by a
 * subsequent migration).
 */
export const REQUIRED_MYSQL_TABLES: readonly string[] = [
  'favorites',
  'oauth_transactions',
  'referrals',
  'sessions',
  'subscriptions',
  'usage_counters',
  'users',
];

/** A single missing-table finding from {@link detectMissingCoreTables}. */
export interface MissingTableIssue {
  table: string;
  /**
   * Short human-readable hint pointing at the most likely cause. Kept
   * generic — the actual Railway/Drizzle specifics live in the README
   * and in the startup WARN message so we don't duplicate operator
   * instructions in two places.
   */
  hint: string;
}

/**
 * Dependency-inverted view of the MySQL catalog used by
 * {@link detectMissingCoreTables}. Exposed as an interface so the unit
 * tests can supply a fake without having to spin up a real MySQL.
 */
export interface SchemaProbe {
  /** Returns the set of table names present in the current database. */
  listTables(): Promise<Set<string>>;
}

/**
 * Scan the live MySQL schema and return any {@link REQUIRED_MYSQL_TABLES}
 * that are missing. An empty array means the schema is healthy.
 *
 * The check is DB-agnostic (any probe that can return the set of
 * existing tables works) to keep the unit tests offline-friendly.
 */
export async function detectMissingCoreTables(
  probe: SchemaProbe,
): Promise<MissingTableIssue[]> {
  const present = await probe.listTables();
  const missing: MissingTableIssue[] = [];
  for (const table of REQUIRED_MYSQL_TABLES) {
    if (!present.has(table)) {
      missing.push({
        table,
        hint: 'table is missing — MySQL migrations likely did not run on this deployment',
      });
    }
  }
  return missing;
}

