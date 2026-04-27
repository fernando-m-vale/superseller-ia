import { NextRequest, NextResponse } from 'next/server';

// App routes that require authentication
const PROTECTED_PATHS = [
  '/overview',
  '/listings',
  '/onboarding',
  '/settings',
  '/ai',
  '/recommendations',
  '/upgrade',
  '/billing',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect authenticated users away from the landing page to the app
  if (pathname === '/') {
    const authCookie = request.cookies.get('ss_auth');
    if (authCookie?.value === '1') {
      return NextResponse.redirect(new URL('/listings', request.url));
    }
  }

  // Protect /register: require ?invite=TOKEN query param
  // Admin routes (/admin/**) are exempt
  if (pathname === '/register') {
    const invite = request.nextUrl.searchParams.get('invite');
    if (!invite) {
      return NextResponse.redirect(new URL('/#lista-de-espera', request.url));
    }
  }

  // Protect app routes: redirect to /login when not authenticated
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
  if (isProtected) {
    const authCookie = request.cookies.get('ss_auth');
    if (!authCookie || authCookie.value !== '1') {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/register',
    '/forgot-password',
    '/reset-password',
    // Each protected route needs both the exact path and the wildcard variant,
    // because /:path* alone may not match the root path without a trailing slash.
    '/overview',
    '/overview/:path*',
    '/listings',
    '/listings/:path*',
    '/onboarding',
    '/onboarding/:path*',
    '/settings',
    '/settings/:path*',
    '/ai',
    '/ai/:path*',
    '/recommendations',
    '/recommendations/:path*',
    '/upgrade',
    '/upgrade/:path*',
    '/billing',
    '/billing/:path*',
  ],
};
