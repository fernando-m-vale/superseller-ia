'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, isAuthenticated } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * AuthGuard component that protects routes from unauthenticated access.
 * 
 * This component:
 * 1. Shows a loading skeleton while checking authentication status
 * 2. Redirects to /login if the user is not authenticated
 * 3. Renders children only when the user is authenticated
 * 
 * Usage:
 * ```tsx
 * <AuthGuard>
 *   <ProtectedContent />
 * </AuthGuard>
 * ```
 * 
 * Note: This uses localStorage for token storage, so we must avoid
 * accessing it during SSR. The check only happens in useEffect after
 * the component mounts on the client.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      // First check if there's a token in localStorage
      if (!isAuthenticated()) {
        if (!cancelled) {
          setStatus('unauthenticated');
          router.replace('/login');
        }
        return;
      }

      // Verify the token is still valid by calling /auth/me
      const user = await getCurrentUser();
      
      if (!cancelled) {
        if (user) {
          setStatus('authenticated');
        } else {
          // Token was invalid or expired, getCurrentUser already cleared it
          setStatus('unauthenticated');
          router.replace('/login');
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Show loading skeleton while checking auth status
  if (status === 'checking') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Redirect in progress, don't render anything
  if (status === 'unauthenticated') {
    return null;
  }

  // User is authenticated, render children
  return <>{children}</>;
}
