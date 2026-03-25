'use client';
import { useRouter } from 'next/navigation';
import { ArrowRight, BarChart2, Zap, Target, CheckCircle, Star, Shield, Eye } from 'lucide-react';

const features = [
  {
    icon: <Target className="w-6 h-6" />,
    title: 'Diagnóstico Preciso',
    description:
      'IA analisa cada anúncio pelo funil real: Descoberta → Clique → Conversão → Crescimento.',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Copy Pronta para Aplicar',
    description: 'Receba título, descrição e atributos otimizados — copie e cole em segundos.',
  },
  {
    icon: <BarChart2 className="w-6 h-6" />,
    title: 'Dados Reais do ML',
    description:
      'Todos os dados vêm diretamente da API oficial do Mercado Livre. Sem invenções.',
  },
];

const steps = [
  { num: '01', title: 'Conecte sua conta', desc: 'OAuth oficial do Mercado Livre. 30 segundos.' },
  {
    num: '02',
    title: 'IA analisa seus anúncios',
    desc: 'GPT-4o + dados reais = diagnóstico cirúrgico.',
  },
  {
    num: '03',
    title: 'Aplique e venda mais',
    desc: 'Ações concretas com copy pronta para usar agora.',
  },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="font-bold text-xl">SuperSeller IA</div>
        <div className="flex items-center gap-4">
          <a href="#precos" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">
            Preços
          </a>
          <button
            onClick={() => router.push('/login')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Entrar
          </button>
          <button
            onClick={() => router.push('/register')}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Testar grátis
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-muted px-4 py-2 rounded-full text-sm mb-6">
          <Star className="w-4 h-4 text-yellow-500" />
          Trial gratuito de 14 dias — sem cartão
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
          Seu anúncio aparece.<br />
          <span className="text-primary">Mas não vende.</span><br />
          Descubra por quê.
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          IA que analisa seus listings no Mercado Livre e entrega ações concretas
          para aumentar visitas, cliques e conversão.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => router.push('/register')}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-semibold text-lg hover:bg-primary/90 transition-colors"
          >
            Analisar meus anúncios grátis
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-sm text-muted-foreground">
            Sem cartão · 14 dias grátis · Cancele quando quiser
          </p>
        </div>
      </section>

      {/* Como funciona */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">Como funciona</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.num} className="text-center">
              <div className="text-4xl font-bold text-primary/20 mb-3">{s.num}</div>
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-muted-foreground text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center mb-12">O que você recebe</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-background rounded-xl p-6 border">
                <div className="text-primary mb-4">{f.icon}</div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preços */}
      <section id="precos" className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-4">Preços simples e transparentes</h2>
        <p className="text-center text-muted-foreground mb-12">
          Comece grátis. Faça upgrade quando quiser.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Free */}
          <div className="border rounded-xl p-6">
            <h3 className="font-bold text-lg mb-1">Gratuito</h3>
            <div className="text-3xl font-bold mb-4">R$0</div>
            <ul className="space-y-2 mb-6">
              {['3 análises de IA/mês', '1 marketplace', 'Diagnóstico básico', 'Histórico 7 dias'].map(
                (f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> {f}
                  </li>
                ),
              )}
            </ul>
            <button
              onClick={() => router.push('/register')}
              className="w-full border rounded-lg py-3 text-sm font-medium hover:bg-muted transition-colors"
            >
              Começar grátis
            </button>
          </div>

          {/* Pro */}
          <div className="border-2 border-primary rounded-xl p-6 bg-primary/5 relative">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-lg">Pro</h3>
              <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                14 dias grátis
              </span>
            </div>
            <div className="text-3xl font-bold mb-4">
              R$297
              <span className="text-base font-normal text-muted-foreground">/mês</span>
            </div>
            <ul className="space-y-2 mb-6">
              {[
                'Análises ilimitadas',
                'Todos os marketplaces',
                'Copy pronta para aplicar',
                'Sync automático diário',
                'Histórico 90 dias',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => router.push('/register')}
              className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Começar trial grátis →
            </button>
          </div>
        </div>
      </section>

      {/* Confiança */}
      <section className="bg-muted/50 py-12">
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <Shield className="w-8 h-8 text-primary" />
              <span className="font-semibold text-sm">OAuth oficial do ML</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Eye className="w-8 h-8 text-primary" />
              <span className="font-semibold text-sm">Dados reais, sem invenções</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="w-8 h-8 text-primary" />
              <span className="font-semibold text-sm">Cancele quando quiser</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-primary text-primary-foreground py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Pronto para vender mais?</h2>
        <p className="mb-8 opacity-90">14 dias grátis. Sem cartão. Cancele quando quiser.</p>
        <button
          onClick={() => router.push('/register')}
          className="bg-white text-primary px-8 py-4 rounded-xl font-semibold hover:bg-white/90 transition-colors"
        >
          Começar agora →
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8 text-center text-sm text-muted-foreground">
        © 2026 SuperSeller IA ·{' '}
        <a href="/legal/privacy" className="hover:underline">
          Privacidade
        </a>{' '}
        ·{' '}
        <a href="/legal/terms" className="hover:underline">
          Termos
        </a>
      </footer>
    </div>
  );
}
