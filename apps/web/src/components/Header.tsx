'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { logout, isAuthenticated, getCurrentUser, AuthUser } from '@/lib/auth';
import { LogOut, User } from 'lucide-react';

export function Header() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    const checkAuth = async () => {
      if (isAuthenticated()) {
        setIsLoggedIn(true);
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
      }
    };
    checkAuth();
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary">Super Seller IA</h1>
          <p className="text-muted-foreground">Otimize seus anúncios com inteligência artificial</p>
        </div>
        {mounted && (
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <>
                {user && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{user.email}</span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/login')}
                >
                  Entrar
                </Button>
                <Button
                  size="sm"
                  onClick={() => router.push('/register')}
                >
                  Criar Conta
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
