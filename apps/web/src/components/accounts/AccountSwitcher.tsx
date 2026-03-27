'use client';
import { useState } from 'react';
import { useConnections } from '@/hooks/use-connections';
import { useBilling } from '@/hooks/use-billing';
import { ChevronDown, Plus, Check, Layers, Store, Trash2 } from 'lucide-react';

export function AccountSwitcher() {
  const { connections, displayName, isViewingAll, switchAccount, removeConnection, addConnection } = useConnections();
  const { isPro } = useBilling();
  const [open, setOpen] = useState(false);

  if (!connections) return null;

  const canAddMore = isPro || connections.count < 2;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm font-medium"
      >
        <Store className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left truncate">{displayName}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Ver todas */}
          <button
            onClick={() => { switchAccount(null); setOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted text-sm transition-colors"
          >
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-left">Todas as contas</span>
            {isViewingAll && <Check className="w-4 h-4 text-primary" />}
          </button>

          {connections.list.length > 0 && <div className="border-t my-1" />}

          {connections.list.map(conn => (
            <div key={conn.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted group">
              <button
                onClick={() => { switchAccount(conn.id); setOpen(false); }}
                className="flex items-center gap-3 flex-1 text-sm text-left"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  conn.status === 'active' ? 'bg-green-500' : 'bg-red-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {conn.nickname ?? `Conta ${conn.provider_account_id}`}
                  </p>
                  <p className="text-xs text-muted-foreground">Mercado Livre</p>
                </div>
                {conn.id === connections.activeConnectionId && (
                  <Check className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>

              {connections.list.length > 1 && (
                <button
                  onClick={() => {
                    if (confirm(`Remover a conta "${conn.nickname ?? conn.provider_account_id}"?`)) {
                      removeConnection(conn.id);
                      setOpen(false);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          <div className="border-t mt-1">
            {canAddMore ? (
              <button
                onClick={() => { addConnection(); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-primary hover:bg-primary/5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar conta do Mercado Livre
              </button>
            ) : (
              <div className="px-3 py-2.5 text-xs text-muted-foreground">
                <span>Limite de 2 contas no plano Free. </span>
                <a href="/upgrade" className="text-primary hover:underline">Fazer upgrade →</a>
              </div>
            )}
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}
