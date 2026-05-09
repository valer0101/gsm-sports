// @vitest-environment node
// `jose` checks `instanceof Uint8Array` against the Node realm; jsdom owns its
// own globals that fail that check, so this spec opts out of the jsdom default.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { getVerifiedPayload, requiresAuth, middleware } from './middleware';

const TEST_SECRET = 'test-secret-please-do-not-leak-this-is-fixture-only';
const encoder = new TextEncoder();

const sign = (payload: Record<string, unknown>) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .sign(encoder.encode(TEST_SECRET));

const buildRequest = (
  pathname: string,
  opts: {
    cookies?: Record<string, string>;
    acceptLanguage?: string;
  } = {},
): NextRequest => {
  const url = new URL(pathname, 'http://localhost:3001');
  const headers = new Headers();
  const cookieParts: string[] = [];
  for (const [name, value] of Object.entries(opts.cookies ?? {})) {
    cookieParts.push(`${name}=${value}`);
  }
  if (cookieParts.length > 0) headers.set('cookie', cookieParts.join('; '));
  if (opts.acceptLanguage) headers.set('accept-language', opts.acceptLanguage);
  return new NextRequest(url, { headers });
};

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

afterAll(() => {
  delete process.env.JWT_SECRET;
});

describe('requiresAuth', () => {
  it('flags /admin and any nested admin path', () => {
    expect(requiresAuth('/admin')).toBe(true);
    expect(requiresAuth('/admin/tournaments')).toBe(true);
    expect(requiresAuth('/admin/tournaments/new')).toBe(true);
  });

  it('flags /operator and nested operator paths', () => {
    expect(requiresAuth('/operator')).toBe(true);
    expect(requiresAuth('/operator/match/abc-123')).toBe(true);
  });

  it('does not flag public marketing / content paths', () => {
    expect(requiresAuth('/')).toBe(false);
    expect(requiresAuth('/news')).toBe(false);
    expect(requiresAuth('/athletes/p1')).toBe(false);
    expect(requiresAuth('/tournaments/2026-spring')).toBe(false);
    expect(requiresAuth('/auth/login')).toBe(false);
  });

  it('does not match paths that merely contain "admin" or "operator" mid-segment', () => {
    expect(requiresAuth('/blog/admin-stories')).toBe(false);
    expect(requiresAuth('/news/operator-of-the-year')).toBe(false);
  });

  it('does not match locale-prefixed admin routes', () => {
    // Middleware sees the raw pathname; locale routing is handled separately.
    // /admin paths are unprefixed by design — a /ru/admin path is treated as
    // a public news-style route, not as admin. This pins that contract.
    expect(requiresAuth('/ru/admin')).toBe(false);
    expect(requiresAuth('/en/operator')).toBe(false);
  });
});

describe('getVerifiedPayload', () => {
  it('returns the payload for a JWT signed with the configured secret', async () => {
    const token = await sign({ sub: 'u1', roles: ['admin'] });
    const payload = await getVerifiedPayload(token);
    expect(payload).not.toBeNull();
    expect(payload?.roles).toEqual(['admin']);
  });

  it('returns null when JWT_SECRET is unset', async () => {
    const token = await sign({ sub: 'u1', roles: ['admin'] });
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      expect(await getVerifiedPayload(token)).toBeNull();
    } finally {
      process.env.JWT_SECRET = original;
    }
  });

  it('returns null for a token signed with the wrong secret', async () => {
    const wrong = await new SignJWT({ roles: ['admin'] })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(encoder.encode('different-secret'));
    expect(await getVerifiedPayload(wrong)).toBeNull();
  });

  it('returns null for a malformed token', async () => {
    expect(await getVerifiedPayload('not-a-jwt')).toBeNull();
    expect(await getVerifiedPayload('a.b.c')).toBeNull();
  });

  it('returns null for an expired token', async () => {
    // exp = 1 day after the epoch (1970-01-02), well in the past.
    const expired = await new SignJWT({ roles: ['admin'] })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(60 * 60 * 24)
      .sign(encoder.encode(TEST_SECRET));
    expect(await getVerifiedPayload(expired)).toBeNull();
  });
});

describe('middleware — locale cookie attachment', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  it('attaches DEFAULT_LOCALE (hy) when no Accept-Language and no cookie', async () => {
    const res = await middleware(buildRequest('/'));
    expect(res.cookies.get('gsm_lang')?.value).toBe('hy');
  });

  it('detects locale from Accept-Language and attaches it', async () => {
    const res = await middleware(
      buildRequest('/', { acceptLanguage: 'en-US,en;q=0.9' }),
    );
    expect(res.cookies.get('gsm_lang')?.value).toBe('en');
  });

  it('does not overwrite an already-set valid locale cookie', async () => {
    const res = await middleware(
      buildRequest('/', {
        cookies: { gsm_lang: 'ru' },
        acceptLanguage: 'en',
      }),
    );
    // The existing cookie wins — the response should not re-set it.
    expect(res.cookies.get('gsm_lang')).toBeUndefined();
  });

  it('overrides an invalid locale cookie value with the detected one', async () => {
    const res = await middleware(
      buildRequest('/', {
        cookies: { gsm_lang: 'fr' },
        acceptLanguage: 'ru',
      }),
    );
    expect(res.cookies.get('gsm_lang')?.value).toBe('ru');
  });
});

describe('middleware — admin gate', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  it('redirects unauthenticated /admin requests to /auth/login with redirect param', async () => {
    const res = await middleware(buildRequest('/admin/tournaments'));
    expect(res.status).toBe(307); // NextResponse.redirect default
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/auth/login');
    expect(location.searchParams.get('redirect')).toBe('/admin/tournaments');
  });

  it('redirects on invalid JWT', async () => {
    const res = await middleware(
      buildRequest('/admin', { cookies: { access_token: 'garbage' } }),
    );
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/auth/login');
  });

  it('lets admins through to /admin', async () => {
    const token = await sign({ sub: 'u1', roles: ['admin'] });
    const res = await middleware(
      buildRequest('/admin', { cookies: { access_token: token } }),
    );
    // Pass-through response uses NextResponse.next() with an x-middleware-next header,
    // not a redirect. The status is 200 and there is no location.
    expect(res.headers.get('location')).toBeNull();
  });

  it('lets organizers through to /admin', async () => {
    const token = await sign({ sub: 'u1', roles: ['organizer'] });
    const res = await middleware(
      buildRequest('/admin', { cookies: { access_token: token } }),
    );
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects authenticated non-admin users away from /admin to home', async () => {
    const token = await sign({ sub: 'u1', roles: ['operator'] });
    const res = await middleware(
      buildRequest('/admin', { cookies: { access_token: token } }),
    );
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/');
    // /admin denied → not a login redirect, just a homepage bounce.
    expect(location.searchParams.get('redirect')).toBeNull();
  });

  it('redirects logged-in athletes (no staff role) away from /admin', async () => {
    const token = await sign({ sub: 'u1', roles: ['athlete'] });
    const res = await middleware(
      buildRequest('/admin', { cookies: { access_token: token } }),
    );
    expect(new URL(res.headers.get('location')!).pathname).toBe('/');
  });

  it('redirects when token has no roles claim at all', async () => {
    const token = await sign({ sub: 'u1' });
    const res = await middleware(
      buildRequest('/admin', { cookies: { access_token: token } }),
    );
    expect(new URL(res.headers.get('location')!).pathname).toBe('/');
  });
});

describe('middleware — operator gate', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  it('lets operators through to /operator', async () => {
    const token = await sign({ sub: 'u1', roles: ['operator'] });
    const res = await middleware(
      buildRequest('/operator/match/abc', {
        cookies: { access_token: token },
      }),
    );
    expect(res.headers.get('location')).toBeNull();
  });

  it('lets admins access /operator (super-set of operator role)', async () => {
    const token = await sign({ sub: 'u1', roles: ['admin'] });
    const res = await middleware(
      buildRequest('/operator', { cookies: { access_token: token } }),
    );
    expect(res.headers.get('location')).toBeNull();
  });

  it('lets organizers access /operator (super-set)', async () => {
    const token = await sign({ sub: 'u1', roles: ['organizer'] });
    const res = await middleware(
      buildRequest('/operator', { cookies: { access_token: token } }),
    );
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects athletes / spectators away from /operator', async () => {
    const token = await sign({ sub: 'u1', roles: ['athlete'] });
    const res = await middleware(
      buildRequest('/operator', { cookies: { access_token: token } }),
    );
    expect(new URL(res.headers.get('location')!).pathname).toBe('/');
  });
});

describe('middleware — public path passthrough', () => {
  it('does not require auth for the homepage', async () => {
    const res = await middleware(buildRequest('/'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('does not redirect /news even without a token', async () => {
    const res = await middleware(buildRequest('/news'));
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('middleware — auth-redirect carries locale cookie', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  it('attaches the locale cookie even on the login-redirect response', async () => {
    // Without this, an unauthenticated visitor hitting /admin would be sent
    // to /auth/login WITHOUT a locale set, and the login page would render
    // in the default — not what the user requested via Accept-Language.
    const res = await middleware(
      buildRequest('/admin', { acceptLanguage: 'ru-RU,ru;q=0.9' }),
    );
    expect(new URL(res.headers.get('location')!).pathname).toBe('/auth/login');
    expect(res.cookies.get('gsm_lang')?.value).toBe('ru');
  });
});
