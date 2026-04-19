import { lt, or } from 'drizzle-orm';
import { mysqlDb } from '../../db/mysql/client.js';
import { oauthTransactions } from '../../db/mysql/schema/oauth-transactions.js';
import { logger } from '../../utils/logger.js';

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

export function startOAuthTransactionsCleanupJob(): NodeJS.Timeout {
  const runCleanup = async (): Promise<void> => {
    const now = new Date();
    try {
      await mysqlDb
        .delete(oauthTransactions)
        .where(
          or(
            lt(oauthTransactions.expiresAt, now),
            lt(oauthTransactions.consumedAt, now),
          ),
        );
    } catch (err) {
      logger.warn({ err }, 'Failed to cleanup OAuth transactions');
    }
  };

  // Best effort eager cleanup at boot.
  void runCleanup();

  const interval = setInterval(() => {
    void runCleanup();
  }, CLEANUP_INTERVAL_MS);
  interval.unref();
  return interval;
}
