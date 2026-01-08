'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { logout, isAuthenticated, getCurrentUser, AuthUser } from '@/lib/auth';
import { LogOut, User } from 'lucide-react';

export function Header() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

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

  const isHomePage = pathname === '/';

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-primary">SuperSeller IA</h1>
          </Link>
          {mounted && !isLoggedIn && isHomePage && (
            <nav className="hidden md:flex items-center gap-6">
              <a href="#como-funciona" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Como funciona
              </a>
              <a href="#recursos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Recursos
              </a>
              <a href="#dados" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Dados
              </a>
            </nav>
          )}
          {mounted && isLoggedIn && (
            <p className="text-sm text-muted-foreground hidden md:block">Otimize seus anúncios com inteligência artificial</p>
          )}
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
