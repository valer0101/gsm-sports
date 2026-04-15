import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function decodeJwtPayload(token: string): { roles?: string[] } | null {
  try {
    const base64 = token.split('.')[1];
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('access_token')?.value;

  if (!token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = decodeJwtPayload(token);
  const roles: string[] = payload?.roles ?? [];

  // /admin — только admin и organizer
  if (pathname.startsWith('/admin')) {
    if (!roles.includes('admin') && !roles.includes('organizer')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // /operator — только operator (через tournament_operators) + admin + organizer
  if (pathname.startsWith('/operator')) {
    if (!roles.includes('admin') && !roles.includes('organizer') && !roles.includes('operator')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/operator/:path*'],
};
