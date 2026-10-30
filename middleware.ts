import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isAuthDisabled } from '@/lib/auth/open-access';

export async function middleware(req: NextRequest) {
  if (isAuthDisabled()) return NextResponse.next();

  const { pathname, origin } = req.nextUrl;

  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/logout') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/platform/branding') ||
    pathname.startsWith('/front') ||
    pathname.startsWith('/landing') ||
    pathname.startsWith('/videos') ||
    pathname.startsWith('/flags');

  if (isPublicRoute) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });

  if (!token || (token as { invalid?: boolean }).invalid) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', origin));
  }

  const mustChangePassword = Boolean((token as { mustChangePassword?: boolean }).mustChangePassword);
  const isChangePasswordRoute =
    pathname.startsWith('/change-password') || pathname.startsWith('/api/auth/change-password');

  if (mustChangePassword && !isChangePasswordRoute) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'PASSWORD_CHANGE_REQUIRED' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/change-password', origin));
  }

  if (!mustChangePassword && pathname.startsWith('/change-password')) {
    return NextResponse.redirect(new URL('/dashboard', origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|placeholder|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm)$).*)',
  ],
};
