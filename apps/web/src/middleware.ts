import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect authenticated users away from the landing page to the app
  if (pathname === '/') {
    const authCookie = request.cookies.get('ss_auth');
    if (authCookie?.value === '1') {
      return NextResponse.redirect(new URL('/listings', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
