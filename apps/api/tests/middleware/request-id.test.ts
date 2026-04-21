import { describe, it, expect } from 'vitest';
import express from 'express';
import { requestId, isValidRequestId, hashIp } from '@/middleware/request-id';

async function invokeMiddleware(
  req: Partial<express.Request>,
  res: Partial<express.Response>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    requestId()(req as express.Request, res as express.Response, (err?: unknown) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function makeRes(): {
  res: Partial<express.Response>;
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  const res: Partial<express.Response> = {
    setHeader(name: string, value: string | number | readonly string[]) {
      headers[name] = String(value);
      return this as express.Response;
    },
  };
  return { res, headers };
}

describe('middleware/request-id', () => {
  describe('isValidRequestId', () => {
    it('accepts canonical UUIDv4', () => {
      expect(isValidRequestId('1d394e4e-1111-4222-8333-444444444444')).toBe(true);
      expect(isValidRequestId('F47AC10B-58CC-4372-A567-0E02B2C3D479')).toBe(true);
    });

    it('rejects non-v4 UUIDs, empty strings, and smuggled newlines', () => {
      expect(isValidRequestId('')).toBe(false);
      expect(isValidRequestId('not-a-uuid')).toBe(false);
      // v1 UUID (time-based) — same length but version nibble = 1
      expect(isValidRequestId('f47ac10b-58cc-1372-a567-0e02b2c3d479')).toBe(false);
      // Line-injection attempt
      expect(isValidRequestId('f47ac10b-58cc-4372-a567-0e02b2c3d479\n[FAKE LOG]')).toBe(false);
      expect(isValidRequestId(undefined)).toBe(false);
      expect(isValidRequestId(123)).toBe(false);
    });
  });

  describe('requestId middleware', () => {
    it('accepts a valid inbound X-Request-Id and reuses it', async () => {
      const incoming = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const req: Partial<express.Request> = {
        headers: { 'x-request-id': incoming },
      };
      const { res, headers } = makeRes();
      await invokeMiddleware(req, res);
      expect(req.rid).toBe(incoming);
      expect(headers['X-Request-Id']).toBe(incoming);
    });

    it('generates a fresh UUIDv4 when no header is present', async () => {
      const req: Partial<express.Request> = { headers: {} };
      const { res, headers } = makeRes();
      await invokeMiddleware(req, res);
      expect(req.rid).toBeDefined();
      expect(isValidRequestId(req.rid)).toBe(true);
      expect(headers['X-Request-Id']).toBe(req.rid);
    });

    it('rejects spoofed or malformed inbound ids and generates a fresh one', async () => {
      const cases = [
        'not-a-uuid',
        'f47ac10b-58cc-1372-a567-0e02b2c3d479', // v1
        'f47ac10b-58cc-4372-a567-0e02b2c3d479\nINJECTION',
      ];
      for (const spoofed of cases) {
        const req: Partial<express.Request> = {
          headers: { 'x-request-id': spoofed },
        };
        const { res } = makeRes();
        await invokeMiddleware(req, res);
        expect(req.rid).not.toBe(spoofed);
        expect(isValidRequestId(req.rid)).toBe(true);
      }
    });

    it('ignores array-shaped header (smuggling vector)', async () => {
      const req: Partial<express.Request> = {
        // Express typings forbid arrays here at compile time, but real
        // HTTP stacks can produce them; ensure we still normalize.
        headers: { 'x-request-id': ['a', 'b'] as unknown as string },
      };
      const { res } = makeRes();
      await invokeMiddleware(req, res);
      expect(isValidRequestId(req.rid)).toBe(true);
    });
  });

  describe('hashIp', () => {
    it('returns null for empty input', () => {
      expect(hashIp(null, 'pepper')).toBeNull();
      expect(hashIp('', 'pepper')).toBeNull();
    });

    it('returns a 64-char hex fingerprint that varies with pepper', () => {
      const a = hashIp('203.0.113.5', 'pepper-a');
      const b = hashIp('203.0.113.5', 'pepper-b');
      expect(a).toMatch(/^[0-9a-f]{64}$/);
      expect(b).toMatch(/^[0-9a-f]{64}$/);
      expect(a).not.toBe(b);
    });

    it('never returns the raw IP', () => {
      const raw = '203.0.113.5';
      const hashed = hashIp(raw, 'pepper');
      expect(hashed).not.toContain(raw);
    });
  });
});
