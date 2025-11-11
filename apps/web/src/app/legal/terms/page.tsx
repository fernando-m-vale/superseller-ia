import type { Metadata } from 'next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Termos de Uso - Super Seller IA',
  description: 'Termos de Uso da SuperSeller IA - Condições para utilização da plataforma',
  robots: 'index, follow',
}

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Termos de Uso</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p>Estes Termos regem o uso da plataforma da <strong>SuperSeller IA Ltda</strong>. Ao criar uma conta ou utilizar nossos serviços, você concorda com as condições abaixo.</p>

          <h2 className="text-xl font-semibold mt-6 mb-3">1. Definições</h2>
          <p>"Plataforma" refere-se ao software de análise e automação para marketplaces; "Usuário" é a pessoa física ou jurídica que cria conta e utiliza o serviço.</p>

          <h2 className="text-xl font-semibold mt-6 mb-3">2. Aceite e alterações</h2>
          <p>Ao utilizar a Plataforma, você aceita estes Termos e nossa <a href="/legal/privacy" className="text-primary hover:underline">Política de Privacidade</a>.</p>

          <h2 className="text-xl font-semibold mt-6 mb-3">3. Cadastro e conta</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Fornecer informações verdadeiras e manter credenciais seguras;</li>
            <li>Responsabilizar-se por atividades de sua conta;</li>
            <li>Podemos suspender contas em caso de violação destes Termos.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-6 mb-3">4. Escopo do serviço</h2>
          <p>A Plataforma oferece coleta, análise e recomendações para otimização de anúncios. Recursos podem variar conforme plano e ambiente (piloto, beta, produção).</p>

          <h2 className="text-xl font-semibold mt-6 mb-3">5. Limitação de responsabilidade</h2>
          <p>O serviço é fornecido "no estado em que se encontra". Não garantimos resultados específicos. A responsabilidade total da SuperSeller IA limita-se aos valores pagos nos últimos 12 meses.</p>

          <h2 className="text-xl font-semibold mt-6 mb-3">6. Privacidade e proteção de dados</h2>
          <p>Tratamos dados conforme a <a href="/legal/privacy" className="text-primary hover:underline">Política de Privacidade</a> e a LGPD.</p>

          <h2 className="text-xl font-semibold mt-6 mb-3">7. Contato</h2>
          <p>Dúvidas: <a href="mailto:suporte@superselleria.com.br" className="text-primary hover:underline">suporte@superselleria.com.br</a></p>

          <p className="text-sm text-muted-foreground mt-4">SuperSeller IA Ltda — Última atualização em 11/11/2025.</p>
        </CardContent>
      </Card>
    </div>
  )
}
