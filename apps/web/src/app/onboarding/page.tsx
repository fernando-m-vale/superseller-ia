'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Circle, ArrowRight, Zap, TrendingUp, AlertTriangle, ChevronRight } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type OnboardingStep = 'connect' | 'analyze' | 'result';
const STEP_ORDER: OnboardingStep[] = ['connect', 'analyze', 'result'];

const STEP_LABELS: Record<OnboardingStep, string> = {
  connect: 'Conectar',
  analyze: 'Analisar',
  result: 'Resultado',
};

const LOADING_MESSAGES = [
  'Analisando título e palavras-chave...',
  'Avaliando imagens e qualidade visual...',
  'Calculando seu funil de vendas...',
  'Gerando recomendações personalizadas...',
];

type Listing = {
  id: string;
  title: string;
  thumbnail?: string;
  price?: number;
};

type AnalysisResult = {
  performanceSignal?: string;
  verdict?: string;
  funnelAnalysis?: string;
  growthHacks?: string[];
};

function scoreColor(signal?: string) {
  if (!signal) return 'text-muted-foreground';
  const s = signal.toLowerCase();
  if (s === 'strong' || s === 'alto') return 'text-green-600';
  if (s === 'medium' || s === 'médio' || s === 'medio') return 'text-yellow-600';
  return 'text-red-600';
}

function scoreLabel(signal?: string) {
  if (!signal) return 'N/A';
  const s = signal.toLowerCase();
  if (s === 'strong') return 'Alto';
  if (s === 'medium') return 'Médio';
  if (s === 'weak') return 'Baixo';
  return signal;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('connect');
  const [isConnected, setIsConnected] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rotate loading messages
  useEffect(() => {
    if (!analyzing) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [analyzing]);

  // Check if ML is already connected
  const checkConnection = useCallback(async () => {
    const token = getAccessToken();
    try {
      const r = await fetch(`${getApiBaseUrl()}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      const onboarded = d?.onboarding?.completed;
      if (onboarded) {
        router.replace('/listings');
        return;
      }

      // Check marketplace connections
      const connR = await fetch(`${getApiBaseUrl()}/auth/mercadolivre/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (connR.ok) {
        const connD = await connR.json();
        if (connD.connected) {
          setIsConnected(true);
          await fetchListings(token ?? '');
          setStep('analyze');
        }
      }
    } catch {
      // continue with connect step
    }
  }, [router]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const fetchListings = async (token: string) => {
    try {
      const r = await fetch(`${getApiBaseUrl()}/listings?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        const items: Listing[] = (d.listings ?? d.data ?? d ?? []).slice(0, 10);
        setListings(items);
        if (items.length > 0) setSelectedId(items[0].id);
      }
    } catch {
      // ignore
    }
  };

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

  const handleAnalyze = async () => {
    if (!selectedId) return;
    setError(null);
    setAnalyzing(true);

    const token = getAccessToken();
    try {
      const r = await fetch(`${getApiBaseUrl()}/ai/analyze`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listingId: selectedId }),
      });

      if (!r.ok) {
        const errD = await r.json().catch(() => ({}));
        throw new Error(errD.message ?? 'Erro ao analisar anúncio');
      }

      const d = await r.json();
      const verdict = d.verdict ?? d.analysis ?? d;

      setResult({
        performanceSignal: verdict.performanceSignal ?? verdict.performance_signal,
        verdict: verdict.verdict ?? verdict.summary,
        funnelAnalysis: verdict.funnelAnalysis ?? verdict.funnel_analysis,
        growthHacks: verdict.growthHacks ?? verdict.growth_hacks ?? [],
      });

      // Mark onboarding as complete
      await fetch(`${getApiBaseUrl()}/auth/onboarding`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ step: 3, completed: true }),
      }).catch(() => {});

      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao analisar anúncio');
    } finally {
      setAnalyzing(false);
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

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEP_ORDER.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {isStepDone(s) ? (
                <CheckCircle className="w-6 h-6 text-primary" />
              ) : step === s ? (
                <CheckCircle className="w-6 h-6 text-primary" />
              ) : (
                <Circle className="w-6 h-6 text-muted-foreground" />
              )}
              <span className={`text-sm ${step === s ? 'font-medium' : 'text-muted-foreground'}`}>
                {STEP_LABELS[s]}
              </span>
              {i < STEP_ORDER.length - 1 && (
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        {/* ── Passo 1: Conectar ML ── */}
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
              onClick={async () => {
                const token = getAccessToken();
                await fetchListings(token ?? '');
                setIsConnected(true);
                setStep('analyze');
              }}
              className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Já conectei, ir para análise →
            </button>
          </div>
        )}

        {/* ── Passo 2: Selecionar anúncio e analisar ── */}
        {step === 'analyze' && (
          <div className="border rounded-xl p-6 bg-card">
            <h2 className="text-xl font-semibold mb-4">
              {analyzing ? 'Analisando seu anúncio...' : 'Escolha um anúncio para analisar'}
            </h2>

            {analyzing ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground animate-pulse">{LOADING_MESSAGES[loadingMsgIdx]}</p>
              </div>
            ) : (
              <>
                {listings.length === 0 ? (
                  <p className="text-sm text-muted-foreground mb-4">
                    Nenhum anúncio encontrado. Verifique a conexão com o Mercado Livre.
                  </p>
                ) : (
                  <ul className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                    {listings.map((l) => (
                      <li key={l.id}>
                        <button
                          onClick={() => setSelectedId(l.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center gap-3 text-sm ${
                            selectedId === l.id
                              ? 'border-primary bg-primary/5 font-medium'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          {l.thumbnail && (
                            <span
                              className="w-10 h-10 rounded shrink-0 bg-cover bg-center bg-no-repeat block"
                              style={{ backgroundImage: `url(${l.thumbnail})` }}
                              role="img"
                              aria-label=""
                            />
                          )}
                          <span className="line-clamp-2">{l.title}</span>
                          {selectedId === l.id && (
                            <CheckCircle className="w-4 h-4 text-primary ml-auto shrink-0" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm mb-3 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleAnalyze}
                  disabled={!selectedId || !isConnected}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Analisar com IA →
                </button>
                <button
                  onClick={() => router.push('/listings')}
                  className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Pular e ver todos os anúncios
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Passo 3: Resultado ── */}
        {step === 'result' && result && (
          <div className="border rounded-xl p-6 bg-card space-y-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Diagnóstico do seu anúncio</h2>
            </div>

            {/* Performance signal */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Performance:</span>
              <span className={`font-bold text-lg ${scoreColor(result.performanceSignal)}`}>
                {scoreLabel(result.performanceSignal)}
              </span>
            </div>

            {/* Verdict */}
            {result.verdict && (
              <div>
                <p className="text-sm font-medium mb-1 text-muted-foreground uppercase tracking-wide">Diagnóstico</p>
                <p className="text-sm leading-relaxed">{result.verdict}</p>
              </div>
            )}

            {/* Funnel */}
            {result.funnelAnalysis && (
              <div>
                <p className="text-sm font-medium mb-1 text-muted-foreground uppercase tracking-wide">Funil de vendas</p>
                <p className="text-sm leading-relaxed">{result.funnelAnalysis}</p>
              </div>
            )}

            {/* Growth hack */}
            {result.growthHacks && result.growthHacks.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Ação prioritária</p>
                </div>
                <p className="text-sm">{result.growthHacks[0]}</p>
              </div>
            )}

            <button
              onClick={() => router.push('/listings')}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold transition-colors hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              Ver todos os anúncios
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
