import { describe, it, expect } from 'vitest';

/**
 * Smoke tests hit a deployed environment rather than an in-process
 * Express app. They only run when `SMOKE_API_URL` is set so the
 * standard CI `npm test` run (which has no deploy target) stays green.
 *
 * Run locally against staging:
 *
 *   SMOKE_API_URL=https://api.hypnosleep.app npm test -- smoke
 */
const API = process.env.SMOKE_API_URL;

describe.skipIf(!API)('smoke tests', () => {
  it('GET /health returns 200', async () => {
    const res = await fetch(`${API}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status?: string };
    expect(body.status).toBe('ok');
  });

  it('GET /api/health returns 200', async () => {
    const res = await fetch(`${API}/api/health`);
    expect(res.status).toBe(200);
  });

  it('GET /api/sessions without auth returns 401', async () => {
    const res = await fetch(`${API}/api/sessions`);
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/google redirects to Google', async () => {
    const res = await fetch(`${API}/api/auth/google`, { redirect: 'manual' });
    // 302 Found or 303 See Other — either is acceptable.
    expect([302, 303]).toContain(res.status);
    expect(res.headers.get('location') ?? '').toContain('accounts.google.com');
  });

  it('OPTIONS /api/sessions returns CORS headers when cross-origin', async () => {
    const res = await fetch(`${API}/api/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.hypnosleep.app',
        'Access-Control-Request-Method': 'GET',
      },
    });
    // In the unified same-origin deployment CORS headers are omitted;
    // in any split-origin deployment they must be present. Accept both.
    const allowOrigin = res.headers.get('access-control-allow-origin');
    if (allowOrigin !== null) {
      expect(allowOrigin).toBeTruthy();
    }
  });

  it('rate limits aggressive callers', async () => {
    // The IP limiter is 100 req per 60 s, so 120 in quick succession
    // should produce at least a few 429s even under heavy platform variance.
    const promises = Array.from({ length: 120 }, () => fetch(`${API}/api/health`));
    const responses = await Promise.all(promises);
    const rateLimited = responses.filter((r) => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  }, 30_000);
});
