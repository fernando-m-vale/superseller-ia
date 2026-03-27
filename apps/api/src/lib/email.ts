import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? 'SuperSeller IA <noreply@superselleria.com.br>';
const APP_URL = process.env.APP_URL ?? 'https://app.superselleria.com.br';

// ── Helpers ────────────────────────────────────────────────────────────────

function baseHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:0">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
    <div style="margin-bottom:24px">
      <span style="font-size:20px;font-weight:700;color:#111">SuperSeller IA</span>
    </div>
    ${body}
    <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb">
    <p style="font-size:12px;color:#9ca3af;margin:0">Você está recebendo este e-mail porque se cadastrou na SuperSeller IA. <a href="${APP_URL}" style="color:#6b7280">superselleria.com.br</a></p>
  </div>
</body>
</html>`;
}

function btn(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;margin-top:16px">${text}</a>`;
}

// ── Templates ──────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string, trialEndsAt: Date): Promise<void> {
  const days = Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000);
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Bem-vindo à SuperSeller IA — seu trial Pro de ${days} dias começou!`,
    html: baseHtml(`
      <h1 style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px">Olá, ${name}! 👋</h1>
      <p style="color:#374151;line-height:1.6;margin:0 0 16px">Sua conta foi criada com sucesso. Você tem <strong>${days} dias de acesso completo ao plano Pro</strong> — sem cartão, sem compromisso.</p>
      <p style="color:#374151;line-height:1.6;margin:0 0 8px">Com o trial você pode:</p>
      <ul style="color:#374151;line-height:1.8;margin:0 0 16px;padding-left:20px">
        <li>Conectar múltiplas contas do Mercado Livre</li>
        <li>Análises IA ilimitadas dos seus anúncios</li>
        <li>Plano de ação detalhado para cada anúncio</li>
        <li>Sincronização automática de métricas</li>
      </ul>
      ${btn('Acessar o painel →', `${APP_URL}/dashboard`)}
    `),
  });
}

export async function sendTrialMidpointEmail(to: string, name: string, trialEndsAt: Date): Promise<void> {
  const days = Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000);
  await resend.emails.send({
    from: FROM,
    to,
    subject: `${days} dias de trial restantes — continue sua jornada Pro`,
    html: baseHtml(`
      <h1 style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px">Metade do caminho! ⚡</h1>
      <p style="color:#374151;line-height:1.6;margin:0 0 16px">Você está no meio do seu trial. Ainda tem <strong>${days} dias</strong> para explorar todos os recursos Pro.</p>
      <p style="color:#374151;line-height:1.6;margin:0 0 16px">Aproveite para analisar seus anúncios com IA e identificar oportunidades de crescimento antes do trial encerrar.</p>
      ${btn('Analisar anúncios agora →', `${APP_URL}/listings`)}
    `),
  });
}

export async function sendTrialExpiringEmail(to: string, name: string, trialEndsAt: Date): Promise<void> {
  const days = Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000);
  await resend.emails.send({
    from: FROM,
    to,
    subject: `⚠️ Seu trial encerra em ${days} dia${days !== 1 ? 's' : ''} — garanta o Pro`,
    html: baseHtml(`
      <h1 style="font-size:22px;font-weight:700;color:#dc2626;margin:0 0 8px">Seu trial está prestes a encerrar</h1>
      <p style="color:#374151;line-height:1.6;margin:0 0 16px">Faltam apenas <strong>${days} dia${days !== 1 ? 's' : ''}</strong> para o fim do seu trial Pro. Após essa data, sua conta voltará para o plano gratuito.</p>
      <p style="color:#374151;line-height:1.6;margin:0 0 16px">Assine o Pro por <strong>R$297/mês</strong> e mantenha acesso a todas as funcionalidades.</p>
      ${btn('Assinar o plano Pro →', `${APP_URL}/upgrade`)}
    `),
  });
}

export async function sendTrialExpiredEmail(to: string, name: string): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Seu trial encerrou — continue com o plano Pro',
    html: baseHtml(`
      <h1 style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px">Seu trial encerrou</h1>
      <p style="color:#374151;line-height:1.6;margin:0 0 16px">Seu período de trial Pro chegou ao fim. Sua conta foi movida para o plano gratuito.</p>
      <p style="color:#374151;line-height:1.6;margin:0 0 16px">Você ainda pode usar a SuperSeller IA gratuitamente, mas com alguns limites. Para continuar com análises ilimitadas e múltiplas contas, assine o Pro.</p>
      ${btn('Reativar plano Pro →', `${APP_URL}/upgrade`)}
    `),
  });
}

export async function sendDowngradeEmail(to: string, name: string): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Seu plano foi alterado para gratuito',
    html: baseHtml(`
      <h1 style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px">Plano alterado para gratuito</h1>
      <p style="color:#374151;line-height:1.6;margin:0 0 16px">Seu plano Pro foi cancelado e sua conta foi movida para o plano gratuito.</p>
      <p style="color:#374151;line-height:1.6;margin:0 0 16px">Você pode continuar usando a SuperSeller IA com os recursos do plano gratuito ou reativar o Pro a qualquer momento.</p>
      ${btn('Reativar plano Pro →', `${APP_URL}/upgrade`)}
    `),
  });
}

export async function sendWaitlistInviteEmail(to: string, token: string): Promise<void> {
  const registerUrl = `${APP_URL}/register?invite=${token}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Sua vaga na SuperSeller IA está disponível! 🎉',
    html: baseHtml(`
      <h1 style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px">Sua vaga chegou! 🎉</h1>
      <p style="color:#374151;line-height:1.6;margin:0 0 16px">Boa notícia — você foi aprovado para acessar a SuperSeller IA. Clique no botão abaixo para criar sua conta e começar seu trial gratuito de 14 dias.</p>
      <p style="color:#6b7280;font-size:13px;margin:0 0 4px">Este link é válido por 7 dias e pode ser usado apenas uma vez.</p>
      ${btn('Criar minha conta →', registerUrl)}
    `),
  });
}
