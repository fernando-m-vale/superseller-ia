'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Sparkles, 
  TrendingUp, 
  BarChart3, 
  Target, 
  Zap, 
  CheckCircle2, 
  ArrowRight,
  Shield,
  Eye,
  Lightbulb,
  Rocket,
  Users,
  ShoppingBag,
  Store,
  TrendingDown,
  AlertCircle,
  Database,
  Globe,
  Building2,
  Search,
  Megaphone,
  BarChart
} from 'lucide-react'

export default function HomePage() {
  const router = useRouter()

    return (
    <div className="min-h-screen bg-background -mx-4 md:-mx-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-purple-50 dark:to-purple-950/20 pt-24 pb-16 md:pt-32 md:pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="h-3 w-3 mr-2" />
              Inteligência Artificial para Marketplaces
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Otimize seus anúncios com{' '}
              <span className="text-primary">IA</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Aumente suas vendas e melhore seu ROI com análises inteligentes e recomendações automáticas
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6"
                onClick={() => router.push('/register')}
              >
                <Rocket className="h-5 w-5 mr-2" />
                Criar conta grátis
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-6"
                onClick={() => router.push('/login')}
              >
                Entrar
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Problema do Seller */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                O desafio de vender em marketplaces
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Sellers enfrentam dificuldades reais para otimizar seus anúncios e aumentar vendas
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                  <CardTitle>Visibilidade limitada</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Seus anúncios não aparecem nas primeiras páginas de busca, perdendo oportunidades de vendas.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <TrendingDown className="h-8 w-8 text-orange-500 mb-2" />
                  <CardTitle>Conversão baixa</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Muitos anúncios recebem visitas mas não convertem, desperdiçando tráfego e investimento.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Eye className="h-8 w-8 text-blue-500 mb-2" />
                  <CardTitle>Falta de insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Sem dados claros sobre performance, fica difícil saber o que melhorar para aumentar vendas.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section id="como-funciona" className="py-16 md:py-24 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Como funciona
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Em 3 passos simples, você começa a otimizar seus anúncios com IA
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="relative">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">1</span>
                  </div>
                  <h3 className="text-xl font-semibold">Conecte sua conta</h3>
                  <p className="text-muted-foreground">
                    Conecte sua conta do Mercado Livre em segundos. Seus dados ficam seguros e criptografados.
                  </p>
                </div>
                {false && <div className="absolute top-8 left-full w-8 h-0.5 bg-primary hidden md:block" />}
              </div>
              <div className="relative">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">2</span>
                  </div>
                  <h3 className="text-xl font-semibold">IA analisa seus anúncios</h3>
                  <p className="text-muted-foreground">
                    Nossa IA analisa todos os seus anúncios e identifica oportunidades de melhoria em tempo real.
                  </p>
                </div>
                {false && <div className="absolute top-8 left-full w-8 h-0.5 bg-primary hidden md:block" />}
              </div>
              <div>
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">3</span>
                  </div>
                  <h3 className="text-xl font-semibold">Receba recomendações</h3>
                  <p className="text-muted-foreground">
                    Receba recomendações personalizadas e ações práticas para aumentar suas vendas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* O que você consegue fazer */}
      <section id="recursos" className="py-16 md:py-24 bg-muted/30 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                O que você consegue fazer
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Recursos poderosos para otimizar seus anúncios e aumentar suas vendas
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <Lightbulb className="h-8 w-8 text-yellow-500 mb-2" />
                  <CardTitle>Análise Inteligente</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    IA analisa título, descrição, fotos e performance para identificar oportunidades de melhoria.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <TrendingUp className="h-8 w-8 text-green-500 mb-2" />
                  <CardTitle>Score de Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Super Seller Score avalia seus anúncios em múltiplas dimensões e mostra onde melhorar.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Target className="h-8 w-8 text-blue-500 mb-2" />
                  <CardTitle>Recomendações Personalizadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Receba recomendações práticas e acionáveis para otimizar cada anúncio individualmente.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <BarChart3 className="h-8 w-8 text-purple-500 mb-2" />
                  <CardTitle>Dashboard Completo</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Acompanhe visitas, conversões, receita e performance de todos os seus anúncios em um só lugar.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Zap className="h-8 w-8 text-orange-500 mb-2" />
                  <CardTitle>Otimização Automática</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Sugestões automáticas de títulos e descrições otimizados para SEO e conversão.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Users className="h-8 w-8 text-pink-500 mb-2" />
                  <CardTitle>Competitividade</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Compare sua performance com benchmarks do mercado e identifique pontos fortes e fracos.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Visão / Roadmap */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Uma plataforma, todos os marketplaces
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                O SuperSeller IA está sendo construído para ser sua central de crescimento em marketplaces — hoje no Mercado Livre, e em breve em outros canais.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                <ShoppingBag className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Mercado Livre</div>
                  <Badge variant="default" className="mt-1">ativo</Badge>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card opacity-75">
                <Store className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Shopee</div>
                  <Badge variant="secondary" className="mt-1">em breve</Badge>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card opacity-75">
                <Building2 className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Amazon</div>
                  <Badge variant="secondary" className="mt-1">em breve</Badge>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card opacity-75">
                <Globe className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Magalu</div>
                  <Badge variant="secondary" className="mt-1">em breve</Badge>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card opacity-60">
                <Search className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Análise de concorrência</div>
                  <Badge variant="outline" className="mt-1">roadmap</Badge>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card opacity-60">
                <Megaphone className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Inteligência de publicidade e Ads</div>
                  <Badge variant="outline" className="mt-1">roadmap</Badge>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card opacity-60 md:col-span-2 lg:col-span-1">
                <BarChart className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Comparação de performance entre canais</div>
                  <Badge variant="outline" className="mt-1">roadmap</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dados & Transparência */}
      <section id="dados" className="py-16 md:py-24 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-purple-50 dark:to-purple-950/20">
              <CardHeader className="text-center">
                <Database className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle className="text-2xl md:text-3xl">Dados & Transparência</CardTitle>
                <CardDescription className="text-base">
                  Acreditamos em transparência total com seus dados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-center">
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Todos os dados exibidos vêm diretamente da API oficial do Mercado Livre. Não inventamos números. 
                  Quando uma métrica não está disponível via API, informamos claramente.
                </p>
                <div className="flex flex-wrap justify-center gap-4 pt-4">
                  <Badge variant="secondary" className="text-sm">
                    <Shield className="h-3 w-3 mr-2" />
                    Dados reais
                  </Badge>
                  <Badge variant="secondary" className="text-sm">
                    <Eye className="h-3 w-3 mr-2" />
                    Transparência total
                  </Badge>
                  <Badge variant="secondary" className="text-sm">
                    <CheckCircle2 className="h-3 w-3 mr-2" />
                    Sem invenções
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Visão de Futuro */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Visão de Futuro
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Expandindo para suportar múltiplos marketplaces
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <ShoppingBag className="h-8 w-8 text-blue-500" />
                    <CardTitle>Mercado Livre</CardTitle>
                    <Badge variant="default">Disponível agora</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Suporte completo para Mercado Livre com análises de IA, métricas e recomendações automáticas.
                  </p>
                </CardContent>
              </Card>
              <Card className="opacity-60">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Store className="h-8 w-8 text-orange-500" />
                    <CardTitle>Shopee</CardTitle>
                    <Badge variant="secondary">Em breve</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Suporte para Shopee será adicionado em breve, expandindo as capacidades da plataforma.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Seção de Confiança */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                Confie na nossa plataforma
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Segurança, privacidade e transparência são nossas prioridades
              </p>
              <div className="grid md:grid-cols-3 gap-6 pt-8">
                <div className="flex flex-col items-center text-center space-y-2">
                  <Shield className="h-10 w-10 text-primary" />
                  <h3 className="font-semibold">Seguro</h3>
                  <p className="text-sm text-muted-foreground">
                    Autenticação OAuth oficial do Mercado Livre
                  </p>
                </div>
                <div className="flex flex-col items-center text-center space-y-2">
                  <Eye className="h-10 w-10 text-primary" />
                  <h3 className="font-semibold">Transparente</h3>
                  <p className="text-sm text-muted-foreground">
                    Apenas dados reais, sem invenções ou estimativas falsas
                  </p>
                </div>
                <div className="flex flex-col items-center text-center space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                  <h3 className="font-semibold">Confiável</h3>
            <p className="text-sm text-muted-foreground">
                    Dados direto da API oficial, sempre atualizados
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-primary/10 via-background to-purple-50 dark:to-purple-950/20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-5xl font-bold">
              Pronto para aumentar suas vendas?
            </h2>
            <p className="text-xl text-muted-foreground">
              Comece grátis e veja a diferença que a IA pode fazer nos seus anúncios
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6"
                onClick={() => router.push('/register')}
              >
                <Rocket className="h-5 w-5 mr-2" />
                Criar conta grátis
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-6"
                onClick={() => router.push('/login')}
              >
                Já tenho conta
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}