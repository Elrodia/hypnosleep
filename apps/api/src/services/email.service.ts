import { logger } from '../utils/logger.js';

/**
 * Minimal transactional email service.
 *
 * The production deployment uses a hosted provider (Resend/SES/Postmark)
 * but that integration is intentionally out-of-scope for this module — we
 * only need a stable, well-typed seam that callers (subscription webhook,
 * dunning, welcome mailers) can depend on without pulling in a new
 * dependency or leaking a vendor SDK into business logic.
 *
 * Default behaviour: log the outbound message at info level and resolve
 * successfully. Provider integration can be added later by swapping out
 * the body of `sendEmail` without touching any callers.
 */
export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  /** Provider-assigned message id when available; undefined for the log-only transport. */
  id?: string;
  /** Which transport actually handled the send (`log` by default). */
  transport: 'log';
}

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  logger.info(
    {
      to: input.to,
      subject: input.subject,
      // Deliberately do NOT log the full html/text body — transactional
      // emails regularly contain PII, magic links, or billing details.
      htmlLength: input.html.length,
      textLength: input.text?.length ?? 0,
    },
    'Outbound email (log transport)',
  );
  return { transport: 'log' };
}
