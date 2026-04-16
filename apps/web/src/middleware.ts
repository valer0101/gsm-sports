import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('access_token')?.value;

  if (!token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await getVerifiedPayload(token);

  if (!payload) {
    // Invalid / tampered token — treat as unauthenticated
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const roles: string[] = payload?.roles ?? [];

  // /admin — only admin and organizer
  if (pathname.startsWith('/admin')) {
    if (!roles.includes('admin') && !roles.includes('organizer')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // /operator — operator + admin + organizer
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
