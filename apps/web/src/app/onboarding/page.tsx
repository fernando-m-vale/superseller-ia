'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Circle, ArrowRight, Zap } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type OnboardingStep = 'connect' | 'analyze' | 'done';

const loadingMessages = [
  'Analisando título e palavras-chave...',
  'Avaliando imagens e qualidade visual...',
  'Calculando seu funil de vendas...',
  'Gerando recomendações personalizadas...',
];

const STEP_ORDER: OnboardingStep[] = ['connect', 'analyze', 'done'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step] = useState<OnboardingStep>('connect');
  const [analyzing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);

  useEffect(() => {
    if (!analyzing) return;
    const interval = setInterval(() => {
      setLoadingMsg((prev) => (prev + 1) % loadingMessages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [analyzing]);

  const handleConnectML = async () => {
    const token = getAccessToken();
    try {
      const r = await fetch(`${getApiBaseUrl()}/auth/mercadolivre/connect`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.authUrl) window.location.href = d.authUrl;
    } catch {
      router.push('/listings');
    }
  };

  const isStepDone = (s: OnboardingStep) =>
    STEP_ORDER.indexOf(s) < STEP_ORDER.indexOf(step);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium mb-4 dark:bg-green-950/40 dark:text-green-400">
            <Zap className="w-4 h-4" />
            Trial Pro ativo — 14 dias grátis
          </div>
          <h1 className="text-2xl font-bold mb-2">Vamos começar!</h1>
          <p className="text-muted-foreground">
            Em 2 minutos você vai ver o diagnóstico real dos seus anúncios.
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEP_ORDER.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {isStepDone(s) || step === s ? (
                <CheckCircle className="w-6 h-6 text-primary" />
              ) : (
                <Circle className="w-6 h-6 text-muted-foreground" />
              )}
              <span className={`text-sm ${step === s ? 'font-medium' : 'text-muted-foreground'}`}>
                {s === 'connect' ? 'Conectar' : s === 'analyze' ? 'Analisar' : 'Resultado'}
              </span>
              {i < STEP_ORDER.length - 1 && (
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {step === 'connect' && (
          <div className="border rounded-xl p-6 text-center bg-card">
            <div className="text-4xl mb-4">🛒</div>
            <h2 className="text-xl font-semibold mb-2">Conecte seu Mercado Livre</h2>
            <p className="text-muted-foreground mb-6">
              Autorize o acesso em 30 segundos. Seus dados ficam seguros e você pode revogar quando quiser.
            </p>
            <button
              onClick={handleConnectML}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-3 rounded-lg transition-colors"
            >
              Conectar Mercado Livre
            </button>
            <button
              onClick={() => router.push('/listings')}
              className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Já conectei, ir para os anúncios →
            </button>
          </div>
        )}

        {step === 'analyze' && (
          <div className="border rounded-xl p-6 bg-card">
            <h2 className="text-xl font-semibold mb-4">
              {analyzing ? 'Analisando seu anúncio...' : 'Indo para seus anúncios'}
            </h2>
            {analyzing ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground animate-pulse">{loadingMessages[loadingMsg]}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/listings')}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold
                    transition-colors hover:bg-primary/90"
                >
                  Ver meus anúncios →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
