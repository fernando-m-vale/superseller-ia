import type { Metadata } from 'next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Política de Privacidade | SuperSeller IA',
  description: 'Saiba como tratamos e protegemos seus dados conforme a LGPD.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://app.superselleria.com.br/legal/privacy',
  },
}

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Política de Privacidade</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p>Esta Política descreve como a <strong>SuperSeller IA Ltda</strong> ("SuperSeller IA", "nós") coleta, utiliza e protege dados pessoais em sua plataforma de análise e automação para marketplaces.</p>

          <h2 className="text-xl font-semibold mt-6 mb-3">1. Bases legais e princípios (LGPD)</h2>
          <p>Tratamos dados pessoais conforme a Lei nº 13.709/2018 (LGPD), respeitando os princípios de finalidade, adequação, necessidade, transparência, segurança e não discriminação. As bases legais incluem execução de contrato, legítimo interesse, cumprimento de obrigação legal e consentimento, quando aplicável.</p>

          <h2 className="text-xl font-semibold mt-6 mb-3">2. Dados coletados</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Cadastro:</strong> nome, e-mail, empresa, cargo e senha (hash);</li>
            <li><strong>Uso da plataforma:</strong> logs técnicos, preferências e ações realizadas;</li>
            <li><strong>Integrações com marketplaces:</strong> tokens OAuth, IDs de conta, anúncios, métricas e catálogo;</li>
            <li><strong>Cookies e analytics:</strong> cookies essenciais e métricas de uso.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-6 mb-3">3. Finalidades de uso</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Prover e melhorar a plataforma;</li>
            <li>Autenticar usuários e manter a segurança;</li>
            <li>Atender solicitações de suporte;</li>
            <li>Cumprir obrigações legais e antifraude;</li>
            <li>Mensurar uso e aprimorar a experiência.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-6 mb-3">4. Compartilhamento</h2>
          <p>Podemos compartilhar dados com provedores de nuvem, analytics e marketplaces integrados, estritamente para as finalidades descritas. Não vendemos dados pessoais.</p>

          <h2 className="text-xl font-semibold mt-6 mb-3">5. Segurança e retenção</h2>
          <p>Adotamos medidas técnicas e organizacionais adequadas, como criptografia, controle de acesso e logs. Mantemos dados pelo tempo necessário às finalidades.</p>

          <h2 className="text-xl font-semibold mt-6 mb-3">6. Direitos do titular</h2>
          <p>Você pode solicitar acesso, correção, exclusão, portabilidade e informações sobre compartilhamento de dados via e-mail <a href="mailto:suporte@superselleria.com.br" className="text-primary hover:underline">suporte@superselleria.com.br</a>.</p>

          <h2 className="text-xl font-semibold mt-6 mb-3">7. Contato do Encarregado (DPO)</h2>
          <p>E-mail: <a href="mailto:suporte@superselleria.com.br" className="text-primary hover:underline">suporte@superselleria.com.br</a></p>

          <h2 className="text-xl font-semibold mt-6 mb-3">8. Alterações desta Política</h2>
          <p>Esta Política pode ser atualizada a qualquer momento. A data de "Atualizado em" indica a versão vigente.</p>

          <p className="text-sm text-muted-foreground mt-4">SuperSeller IA Ltda — Plataforma de análise e automação para marketplaces.</p>
        </CardContent>
      </Card>
    </div>
  )
}
