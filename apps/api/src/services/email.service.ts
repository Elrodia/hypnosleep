import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

/**
 * Minimal transactional email service.
 *
 * When `RESEND_API_KEY` is configured the email is delivered via the
 * Resend REST API (https://resend.com). Otherwise the message is logged
 * at info level so local / CI environments work without credentials.
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
  /** Which transport actually handled the send. */
  transport: 'resend' | 'log';
}

async function sendViaResend(input: EmailInput, apiKey: string, from: string): Promise<EmailResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { id?: string };
  return { id: data.id, transport: 'resend' };
}

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM ?? 'HypnoSleep <noreply@hypnosleep.app>';

  if (apiKey) {
    try {
      return await sendViaResend(input, apiKey, from);
    } catch (err) {
      logger.error(
        { err, to: input.to, subject: input.subject },
        'Resend delivery failed; falling back to log transport',
      );
    }
  }

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

