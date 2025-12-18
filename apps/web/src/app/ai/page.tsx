'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

function AIPageContent() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Inteligência Artificial</h1>
        <p className="text-muted-foreground">
          Análise inteligente e recomendações para otimizar seus anúncios
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Análise de IA Disponível nos Anúncios</CardTitle>
          </div>
          <CardDescription>
            A funcionalidade de Inteligência Artificial está integrada diretamente nos seus anúncios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose prose-sm max-w-none">
            <p className="text-muted-foreground leading-relaxed">
              Para gerar análises e ver recomendações de IA:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
              <li>Acesse a página de <strong>Anúncios</strong></li>
              <li>Abra um anúncio clicando nele</li>
              <li>Na aba <strong>Inteligência Artificial</strong>, clique em &quot;Gerar Análise Completa&quot;</li>
              <li>Visualize o score, diagnóstico, hacks de crescimento e sugestões de SEO</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AIPage() {
  return (
    <AuthGuard>
      <AIPageContent />
    </AuthGuard>
  );
}
