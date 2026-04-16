'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getApiBaseUrl } from '@/lib/api';
import {
  ArrowRight, BarChart2, Zap, Target, CheckCircle,
  Star, Shield, Eye, TrendingUp, Users, ChevronRight,
} from 'lucide-react';

function scrollToWaitlist(e: React.MouseEvent) {
  e.preventDefault();
  document.getElementById('lista-de-espera')?.scrollIntoView({ behavior: 'smooth' });
}

// ── Waitlist Form ────────────────────────────────────────────────────────────

type WaitlistData = {
  email: string;
  store_name: string;
  gmv_range: string;
  marketplace: string;
};

function WaitlistForm() {
  const [data, setData] = useState<WaitlistData>({
    email: '',
    store_name: '',
    gmv_range: '',
    marketplace: 'mercadolivre',
  });
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.email) return;
    setState('loading');
    try {
      const r = await fetch(`${getApiBaseUrl()}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error('Erro ao entrar na lista');
      setState('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Tente novamente');
      setState('error');
    }
  };

  if (state === 'success') {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">🎉</div>
        <p className="text-xl font-bold mb-1">Você está na lista!</p>
        <p className="text-muted-foreground text-sm">
          Assim que sua vaga abrir, você será o primeiro a saber.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="email"
          required
          placeholder="Seu e-mail"
          value={data.email}
          onChange={(e) => setData({ ...data, email: e.target.value })}
          className="w-full px-4 py-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input
          type="text"
          placeholder="Nome da loja (opcional)"
          value={data.store_name}
          onChange={(e) => setData({ ...data, store_name: e.target.value })}
          className="w-full px-4 py-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          value={data.gmv_range}
          onChange={(e) => setData({ ...data, gmv_range: e.target.value })}
          className="w-full px-4 py-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Faturamento mensal (opcional)</option>
          <option value="0-5k">Até R$ 5 mil</option>
          <option value="5k-20k">R$ 5 mil – R$ 20 mil</option>
          <option value="20k-100k">R$ 20 mil – R$ 100 mil</option>
          <option value="100k+">Acima de R$ 100 mil</option>
        </select>
        <select
          value={data.marketplace}
          onChange={(e) => setData({ ...data, marketplace: e.target.value })}
          className="w-full px-4 py-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="mercadolivre">Mercado Livre</option>
          <option value="shopee">Shopee</option>
          <option value="amazon">Amazon</option>
          <option value="magalu">Magalu</option>
          <option value="outros">Outros</option>
        </select>
      </div>
      {state === 'error' && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}
      <button
        type="submit"
        disabled={state === 'loading'}
        className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold text-sm transition-colors hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {state === 'loading' ? 'Enviando...' : 'Quero entrar na lista de espera →'}
      </button>
    </form>
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Target,
    title: 'Diagnóstico por funil',
    description: 'IA analisa cada anúncio pelo funil real: Descoberta → Clique → Conversão → Crescimento.',
  },
  {
    icon: Zap,
    title: 'Copy pronta para aplicar',
    description: 'Receba título, descrição e atributos otimizados — copie e cole em segundos.',
  },
  {
    icon: BarChart2,
    title: 'Dados reais do ML',
    description: 'Todos os dados vêm diretamente da API oficial do Mercado Livre. Sem invenções.',
  },
  {
    icon: Eye,
    title: 'Visibilidade real',
    description: 'Saiba quantas pessoas viram, clicaram e compraram — e por que saíram sem converter.',
  },
  {
    icon: TrendingUp,
    title: 'Growth hacks acionáveis',
    description: 'Sugestões concretas de preço, título e imagem baseadas nos seus dados reais de venda.',
  },
  {
    icon: Shield,
    title: 'Seguro e sem burocracia',
    description: 'OAuth oficial, sem acesso a senhas. Cancele quando quiser, sem multa.',
  },
];

const STEPS = [
  { num: '01', title: 'Conecte sua conta', desc: 'OAuth oficial do Mercado Livre. 30 segundos.' },
  { num: '02', title: 'IA analisa seus anúncios', desc: 'GPT-4o + dados reais = diagnóstico cirúrgico.' },
  { num: '03', title: 'Aplique e venda mais', desc: 'Copy pronta, recomendações e score de cada anúncio.' },
];

const TESTIMONIALS = [
  {
    name: 'Ana Lima',
    role: 'Vendedora Platinum ML',
    text: 'Em uma semana apliquei as sugestões e minhas conversões subiram 23%. Nunca vi análise tão precisa.',
    stars: 5,
  },
  {
    name: 'Carlos Moura',
    role: 'Loja de eletrônicos, R$ 80k/mês',
    text: 'Encontrei 12 anúncios com título fraco que estavam escondidos do ranking. Já atualizei todos.',
    stars: 5,
  },
  {
    name: 'Fernanda Ramos',
    role: 'Moda feminina, 300+ anúncios',
    text: 'A análise de funil mostrou exatamente onde eu estava perdendo cliente. Vale cada centavo.',
    stars: 5,
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-bold text-lg">Super Seller IA</span>
          <div className="flex items-center gap-3">
            <a href="#recursos" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
              Recursos
            </a>
            <a href="#dados" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
              Dados
            </a>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Entrar
            </Link>
            <a
              href="#lista-de-espera"
              onClick={scrollToWaitlist}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Criar Conta
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-6 dark:bg-amber-950/40 dark:text-amber-400">
          <Zap className="w-4 h-4" />
          Acesso por convite · Vagas limitadas
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
          Veja o que está travando as suas vendas no Mercado Livre
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          A IA analisa seus anúncios pelo funil real e entrega diagnóstico com ações concretas — em minutos. Não em semanas.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#lista-de-espera"
            onClick={scrollToWaitlist}
            className="bg-primary text-primary-foreground px-8 py-4 rounded-xl font-semibold text-lg hover:bg-primary/90 transition-colors flex items-center gap-2 cursor-pointer"
          >
            Solicitar acesso
            <ArrowRight className="w-5 h-5" />
          </a>
          <a href="#como-funciona" className="text-muted-foreground hover:text-foreground text-sm transition-colors flex items-center gap-1">
            Ver como funciona <ChevronRight className="w-4 h-4" />
          </a>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          14 dias grátis do Pro · Sem cartão · Cancele quando quiser
        </p>
      </section>

      {/* Social proof bar */}
      <section id="dados" className="border-y bg-muted/30 py-6">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>+500 vendedores ativos</span>
          </div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4" />
            <span>+50.000 anúncios analisados</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            <span>4.9/5 de avaliação média</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span>OAuth oficial do Mercado Livre</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="max-w-4xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Como funciona</h2>
          <p className="text-muted-foreground">Em 3 passos simples você já tem o diagnóstico dos seus anúncios.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((s) => (
            <div key={s.num} className="text-center">
              <div className="text-4xl font-bold text-primary/20 mb-3">{s.num}</div>
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="bg-muted/30 py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Tudo que você precisa para vender mais</h2>
            <p className="text-muted-foreground">Análise completa, copy pronta, dados reais.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-card border rounded-xl p-6 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">O que dizem nossos vendedores</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="bg-card border rounded-xl p-6">
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                ))}
              </div>
              <p className="text-sm mb-4 leading-relaxed">&ldquo;{t.text}&rdquo;</p>
              <div>
                <p className="font-semibold text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="precos" className="bg-muted/30 py-20">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Preços simples e transparentes</h2>
            <p className="text-muted-foreground">Comece grátis. Assine só se amar.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free */}
            <div className="bg-card border rounded-xl p-6">
              <h3 className="font-bold text-lg mb-1">Gratuito</h3>
              <p className="text-3xl font-bold mb-1">R$ 0</p>
              <p className="text-sm text-muted-foreground mb-6">Para sempre</p>
              <ul className="space-y-2 text-sm mb-6">
                {['3 análises de IA por mês', 'Diagnóstico básico', 'Conexão com Mercado Livre'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#lista-de-espera"
                onClick={scrollToWaitlist}
                className="block text-center border rounded-lg py-2 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
              >
                Solicitar acesso
              </a>
            </div>
            {/* Pro */}
            <div className="bg-primary text-primary-foreground rounded-xl p-6 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">
                  MAIS POPULAR
                </span>
              </div>
              <h3 className="font-bold text-lg mb-1">Pro</h3>
              <p className="text-3xl font-bold mb-1">R$ 297<span className="text-lg font-normal opacity-80">/mês</span></p>
              <p className="text-sm opacity-70 mb-6">ou R$ 247/mês no anual (R$ 2.964/ano — economize 17%)</p>
              <ul className="space-y-2 text-sm mb-6">
                {[
                  'Análises ilimitadas',
                  'Funil completo por anúncio',
                  'Copy otimizada pronta',
                  'Growth hacks acionáveis',
                  'Relatórios e histórico',
                  'Suporte prioritário',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#lista-de-espera"
                onClick={scrollToWaitlist}
                className="block text-center bg-white text-primary rounded-lg py-2 text-sm font-semibold hover:bg-white/90 transition-colors cursor-pointer"
              >
                Solicitar acesso →
              </a>
              <p className="text-xs text-center mt-2 opacity-70">14 dias grátis do Pro com convite</p>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist CTA */}
      <section id="lista-de-espera" className="max-w-2xl mx-auto px-4 py-20">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-3">Solicite seu acesso</h2>
          <p className="text-muted-foreground">
            O acesso à SuperSeller IA é por convite. Entre na lista e avisamos assim que sua vaga abrir.
          </p>
        </div>
        <div className="bg-card border rounded-xl p-6">
          <WaitlistForm />
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto para vender mais?</h2>
          <p className="opacity-80 mb-8">Garanta sua vaga na lista de espera e ganhe 14 dias grátis do Pro.</p>
          <a
            href="#lista-de-espera"
            onClick={scrollToWaitlist}
            className="inline-flex items-center gap-2 bg-white text-primary px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/90 transition-colors cursor-pointer"
          >
            Solicitar acesso
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© 2026 Super Seller IA. Todos os direitos reservados.</span>
          <div className="flex gap-4">
            <Link href="/legal/terms" className="hover:text-foreground transition-colors">Termos de Uso</Link>
            <Link href="/legal/privacy" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
