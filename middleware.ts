import { NextRequest, NextResponse } from 'next/server';
import { getPublicBetaDisabledRouteRule } from '@/lib/betaScope.mjs';

export function middleware(request: NextRequest) {
  const rule = getPublicBetaDisabledRouteRule(request.nextUrl.pathname);

  if (!rule) {
    return NextResponse.next();
  }

  if (rule.kind === 'api' || !rule.redirectTo) {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = rule.redirectTo;
  redirectUrl.search = '';
  return NextResponse.redirect(redirectUrl, 307);
}

export const config = {
  matcher: [
    '/api/guardian/:path*',
    '/coach/guardians/:path*',
    '/profile/guardians/:path*',
    '/guardian/:path*',
  ],
};
