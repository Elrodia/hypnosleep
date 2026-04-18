import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Mock the env module before the service is imported so unit tests don't
 * need real OAuth secrets or database URLs.
 */
vi.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-abc',
    JWT_EXPIRES_IN: '1h',
    FRONTEND_URL: 'https://app.example.test',
    API_URL: 'https://api.example.test',
  },
}));

interface UserRow {
  id: string;
  oauthProvider: 'google' | 'github' | 'microsoft';
  oauthId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: 'free' | 'pro';
  referralCode: string;
  referredBy: string | null;
  preferences: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const userStore: UserRow[] = [];
const insertedUsers: Partial<UserRow>[] = [];
/**
 * FIFO queue of predicates. Each `.select()` call pops the next one and
 * uses it to filter `userStore` for a single `.limit(1)` result. This
 * matches the order of selects issued by `upsertUserFromOAuth`.
 */
const selectQueue: Array<(row: UserRow) => boolean> = [];
// Tracks which row was returned by the most recent select, so `update()`
// can route its `.set()` patch to the matching record.
let lastSelectedRow: UserRow | undefined;

function enqueueSelect(predicate: (row: UserRow) => boolean): void {
  selectQueue.push(predicate);
}

vi.mock('@/db/mysql/client', () => ({
  mysqlDb: {
    select: () => {
      const predicate = selectQueue.shift() ?? (() => false);
      return {
        from: () => ({
          where: () => ({
            limit: async () => {
              const rows = userStore.filter(predicate).slice(0, 1);
              lastSelectedRow = rows[0];
              return rows;
            },
          }),
        }),
      };
    },
    update: () => ({
      set: (patch: Partial<UserRow>) => ({
        where: async () => {
          if (lastSelectedRow) Object.assign(lastSelectedRow, patch);
        },
      }),
    }),
    insert: () => ({
      values: async (row: Partial<UserRow>) => {
        insertedUsers.push(row);
        userStore.push({
          avatarUrl: null,
          referredBy: null,
          preferences: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...row,
        } as UserRow);
      },
    }),
  },
}));

const insertedEvents: Array<{ userId: string; eventType: string; metadata: unknown }> = [];
vi.mock('@/db/postgres/client', () => ({
  pgDb: {
    insert: () => ({
      values: (row: { userId: string; eventType: string; metadata: unknown }) => {
        insertedEvents.push(row);
        // Real drizzle returns a thenable with `.catch`; Promise satisfies it.
        return Promise.resolve(undefined);
      },
    }),
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    eq: (col: unknown, val: unknown) => ({ _kind: 'eq', col, val }),
    and: (...args: unknown[]) => ({ _kind: 'and', args }),
  };
});

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Import after mocks are registered.
const { issueJwt, verifyJwt, upsertUserFromOAuth } = await import('@/modules/auth/auth.service');
const jsonwebtoken = (await import('jsonwebtoken')).default;

function seed(row: Pick<UserRow, 'id' | 'oauthProvider' | 'oauthId' | 'email'> & Partial<UserRow>): UserRow {
  const full: UserRow = {
    name: 'Seed User',
    avatarUrl: null,
    plan: 'free',
    referralCode: 'SEEDCODE01',
    referredBy: null,
    preferences: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...row,
  };
  userStore.push(full);
  return full;
}

beforeEach(() => {
  userStore.length = 0;
  insertedUsers.length = 0;
  insertedEvents.length = 0;
  selectQueue.length = 0;
  lastSelectedRow = undefined;
});

describe('auth.service — JWT', () => {
  it('issues a JWT that round-trips through verifyJwt', () => {
    const token = issueJwt({ id: 'user-123', plan: 'free' });
    const payload = verifyJwt(token);
    expect(payload.userId).toBe('user-123');
    expect(payload.plan).toBe('free');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it('encodes the user plan so requirePro can read it', () => {
    const token = issueJwt({ id: 'u-pro', plan: 'pro' });
    expect(verifyJwt(token).plan).toBe('pro');
  });

  it('throws on a malformed token', () => {
    expect(() => verifyJwt('garbage.not.jwt')).toThrow();
  });

  it('throws when the token is signed with a different secret', () => {
    const foreign = jsonwebtoken.sign({ userId: 'x', plan: 'free' }, 'other-secret');
    expect(() => verifyJwt(foreign)).toThrow();
  });
});

describe('auth.service — upsertUserFromOAuth', () => {
  it('creates a new user on first login and emits a signup event', async () => {
    // Both selects miss.
    enqueueSelect(() => false);
    enqueueSelect(() => false);

    const user = await upsertUserFromOAuth({
      provider: 'google',
      providerId: 'g-1',
      email: 'new@example.com',
      name: 'New User',
      avatarUrl: 'https://img/avatar.png',
    });

    expect(user.email).toBe('new@example.com');
    expect(user.oauthProvider).toBe('google');
    expect(user.oauthId).toBe('g-1');
    expect(user.plan).toBe('free');
    expect(user.referralCode).toMatch(/^[A-Z0-9]{10}$/);
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(insertedUsers).toHaveLength(1);
    expect(insertedEvents).toEqual([
      { userId: user.id, eventType: 'signup', metadata: { provider: 'google' } },
    ]);
  });

  it('refreshes name/avatar for an existing user matched by provider+id and skips the signup event', async () => {
    seed({
      id: 'u-1',
      oauthProvider: 'github',
      oauthId: 'gh-42',
      email: 'existing@example.com',
      name: 'Old Name',
      avatarUrl: 'https://img/old.png',
    });

    // First select hits.
    enqueueSelect((row) => row.oauthProvider === 'github' && row.oauthId === 'gh-42');

    const user = await upsertUserFromOAuth({
      provider: 'github',
      providerId: 'gh-42',
      email: 'existing@example.com',
      name: 'New Name',
      avatarUrl: 'https://img/new.png',
    });

    expect(user.id).toBe('u-1');
    expect(user.name).toBe('New Name');
    expect(user.avatarUrl).toBe('https://img/new.png');
    expect(insertedUsers).toHaveLength(0);
    expect(insertedEvents).toHaveLength(0);
    // The stored row reflects the refreshed values.
    expect(userStore[0].name).toBe('New Name');
    expect(userStore[0].avatarUrl).toBe('https://img/new.png');
  });

  it('clears avatar when the provider no longer returns one', async () => {
    seed({
      id: 'u-1',
      oauthProvider: 'google',
      oauthId: 'g-1',
      email: 'x@example.com',
      name: 'Name',
      avatarUrl: 'https://img/old.png',
    });

    enqueueSelect((row) => row.oauthProvider === 'google' && row.oauthId === 'g-1');

    const user = await upsertUserFromOAuth({
      provider: 'google',
      providerId: 'g-1',
      email: 'x@example.com',
      name: 'Name',
      // no avatarUrl
    });

    expect(user.avatarUrl).toBeNull();
    expect(userStore[0].avatarUrl).toBeNull();
  });

  it('throws EMAIL_PROVIDER_MISMATCH when the email is already owned by another provider', async () => {
    seed({
      id: 'u-2',
      oauthProvider: 'google',
      oauthId: 'g-existing',
      email: 'clash@example.com',
      name: 'Original',
    });

    // 1st select (provider+id): miss. 2nd select (email): hit.
    enqueueSelect(() => false);
    enqueueSelect((row) => row.email === 'clash@example.com');

    await expect(
      upsertUserFromOAuth({
        provider: 'microsoft',
        providerId: 'ms-1',
        email: 'clash@example.com',
        name: 'New Name',
      }),
    ).rejects.toMatchObject({
      name: 'AppError',
      code: 'EMAIL_PROVIDER_MISMATCH',
      statusCode: 409,
    });

    // No insert, no event.
    expect(insertedUsers).toHaveLength(0);
    expect(insertedEvents).toHaveLength(0);
  });
});
