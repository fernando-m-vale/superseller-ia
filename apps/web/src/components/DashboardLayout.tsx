'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  Package, 
  Lightbulb, 
  Settings, 
  LogOut,
  Menu,
  X,
  User,
  ChevronDown,
  Link as LinkIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { clearTokens, getAccessToken } from '@/lib/auth'
import { useAuth } from '@/hooks/use-auth'
import { getApiBaseUrl } from '@/lib/api'

// Feature flag: Temporariamente desativado por instabilidade no backend (erro 500)
// Para reativar, alterar para true
const ENABLE_RECOMMENDATIONS = false

const menuItems = [
  { href: '/overview', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/listings', label: 'Anúncios', icon: Package },
  // Recomendações temporariamente desativada - ver ENABLE_RECOMMENDATIONS acima
  ...(ENABLE_RECOMMENDATIONS ? [{ href: '/recommendations', label: 'Recomendações', icon: Lightbulb }] : []),
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { data: user } = useAuth()

  const handleLogout = () => {
    clearTokens()
    router.push('/')
  }

  const handleConnectAccount = async () => {
    try {
      const token = getAccessToken()
      
      if (!token) {
        router.push('/login')
        return
      }

      const apiUrl = getApiBaseUrl()
      const response = await fetch(`${apiUrl}/auth/mercadolivre/connect`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Falha ao iniciar conexão')
      }

      const data = await response.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      }
    } catch (error) {
      // Log erro sem detalhes sensíveis
      console.error('Erro ao conectar conta')
      // Fallback: redirecionar para overview onde tem o botão de conectar
      router.push('/overview')
    }
  }

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.user-menu-container')) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [userMenuOpen])

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 md:left-0 md:top-0 md:h-full md:z-50 md:bg-card md:border-r">
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-4 border-b">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">SS</span>
          </div>
          <div>
            <h1 className="font-bold text-lg">Super Seller</h1>
            <p className="text-xs text-muted-foreground">IA Platform</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 pointer-events-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer pointer-events-auto',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-5 w-5 pointer-events-none" />
                <span className="pointer-events-none">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t space-y-2 pointer-events-auto">
          <Button
            variant="outline"
            className="w-full justify-start gap-3"
            onClick={handleConnectAccount}
          >
            <LinkIcon className="h-4 w-4" />
            Conectar Nova Conta
          </Button>
          
          {/* User Menu */}
          <div className="relative user-menu-container">
            <Button
              variant="ghost"
              className="w-full justify-between gap-2"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <User className="h-4 w-4 shrink-0" />
                <div className="text-left min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{user?.email || 'Carregando...'}</p>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </Button>
            
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border rounded-md shadow-lg z-50">
                <div className="py-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-none"
                    onClick={() => {
                      router.push('/settings')
                      setUserMenuOpen(false)
                    }}
                  >
                    <Settings className="h-4 w-4" />
                    Configurações
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-none text-destructive hover:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-300 md:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">SS</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">Super Seller</h1>
              <p className="text-xs text-muted-foreground">IA Platform</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3"
            onClick={() => {
              handleConnectAccount()
              setSidebarOpen(false)
            }}
          >
            <LinkIcon className="h-4 w-4" />
            Conectar Nova Conta
          </Button>
          
          {/* User Menu Mobile */}
          <div className="relative user-menu-container">
            <Button
              variant="ghost"
              className="w-full justify-between gap-2"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <User className="h-4 w-4 shrink-0" />
                <div className="text-left min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{user?.email || 'Carregando...'}</p>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </Button>
            
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border rounded-md shadow-lg z-50">
                <div className="py-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-none"
                    onClick={() => {
                      router.push('/settings')
                      setUserMenuOpen(false)
                      setSidebarOpen(false)
                    }}
                  >
                    <Settings className="h-4 w-4" />
                    Configurações
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-none text-destructive hover:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 md:pl-64 min-w-0 relative z-10">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 bg-card border-b px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">SS</span>
            </div>
            <span className="font-semibold">Super Seller</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 md:p-6 lg:p-8 w-full max-w-full overflow-x-hidden pb-20">
          {children}
        </main>
      </div>
    </div>
  )
}

