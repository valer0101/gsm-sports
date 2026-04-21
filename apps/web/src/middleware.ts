import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isLocale,
  pickLocaleFromAcceptLanguage,
} from '@/i18n/config';

async function getVerifiedPayload(token: string): Promise<{ roles?: string[] } | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as { roles?: string[] };
  } catch {
    return null;
  }
}

function attachLocaleCookie(request: NextRequest, response: NextResponse): void {
  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(existing)) return;

  const detected =
    pickLocaleFromAcceptLanguage(request.headers.get('accept-language')) ?? DEFAULT_LOCALE;

  response.cookies.set(LOCALE_COOKIE, detected, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
  });
}

function requiresAuth(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/operator');
}

async function enforceAuth(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('access_token')?.value;

  const toLogin = () => {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  };

  if (!token) return toLogin();

  const payload = await getVerifiedPayload(token);
  if (!payload) return toLogin();

  const roles: string[] = payload?.roles ?? [];

  if (pathname.startsWith('/admin')) {
    if (!roles.includes('admin') && !roles.includes('organizer')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  if (pathname.startsWith('/operator')) {
    if (!roles.includes('admin') && !roles.includes('organizer') && !roles.includes('operator')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  if (requiresAuth(request.nextUrl.pathname)) {
    const authResponse = await enforceAuth(request);
    if (authResponse) {
      attachLocaleCookie(request, authResponse);
      return authResponse;
    }
  }

  const response = NextResponse.next();
  attachLocaleCookie(request, response);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\..*).*)'],
};
