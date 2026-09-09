import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { globalApiRateLimiter } from './lib/security/rate-limit';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 1. Global API Rate Limiting (DDoS Protection)
  if (pathname.startsWith('/api/')) {
    if (globalApiRateLimiter) {
      const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
      const { success } = await globalApiRateLimiter.limit(ip);
      
      if (!success) {
        return new NextResponse('Too Many Requests', { status: 429 });
      }
    }
    // Skip auth logic for APIs
    return NextResponse.next();
  }

  // Skip next internal requests and static files
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.svg'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('mcdaves_sb_access_token');
  const isLoginPage = pathname === '/login';

  // If user has token and is trying to access login, redirect to dashboard
  if (isLoginPage && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user doesn't have token and is trying to access protected route
  if (!isLoginPage && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

