'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BillingSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.push('/overview'), 4000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
      <div className="text-6xl">🎉</div>
      <h1 className="text-2xl font-bold">Bem-vindo ao Pro!</h1>
      <p className="text-muted-foreground max-w-sm">
        Sua assinatura está ativa. Análises ilimitadas, copy pronta e sync automático liberados.
      </p>
      <p className="text-sm text-muted-foreground">Redirecionando em 4 segundos...</p>
    </div>
  );
}
