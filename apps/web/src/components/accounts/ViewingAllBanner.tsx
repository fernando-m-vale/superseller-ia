'use client';
import { useConnections } from '@/hooks/use-connections';

export function ViewingAllBanner() {
  const { isViewingAll, connections } = useConnections();
  if (!isViewingAll || !connections || connections.count <= 1) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 flex items-center gap-2 text-sm text-blue-800 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300">
      <span>👁</span>
      <span>
        Você está vendo <strong>todas as {connections.count} contas</strong> consolidadas.
        Use o seletor no menu para filtrar por conta.
      </span>
    </div>
  );
}
