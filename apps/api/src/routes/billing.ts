import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { getStripe, STRIPE_PRICES, APP_URL } from '../lib/stripe';
import { authGuard } from '../plugins/auth';
import { getEffectivePlan, FREE_LIMITS } from '../lib/plan-guard';
import Stripe from 'stripe';

const prisma = new PrismaClient();

export async function billingRoutes(app: FastifyInstance) {

  // GET /billing/status — estado atual do plano
  app.get('/status', { preHandler: [authGuard] }, async (request, reply) => {
    const tenantId = (request as any).tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        plan: true,
        plan_status: true,
        trial_ends_at: true,
        plan_expires_at: true,
        stripe_customer_id: true,
      },
    });

    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

    // Auto-downgrade silencioso
    if (tenant.plan_status === 'trialing' && tenant.trial_ends_at && tenant.trial_ends_at < new Date()) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { plan: 'free', plan_status: 'active' },
      });
      tenant.plan = 'free';
      tenant.plan_status = 'active';
    }

    const effective = getEffectivePlan(tenant);
    const now = new Date();

    const trialDaysLeft = tenant.trial_ends_at
      ? Math.max(0, Math.ceil((tenant.trial_ends_at.getTime() - now.getTime()) / 86400000))
      : null;

    return reply.send({
      plan: effective,
      planStatus: tenant.plan_status,
      isTrialing: tenant.plan_status === 'trialing' && !!tenant.trial_ends_at && tenant.trial_ends_at > now,
      trialEndsAt: tenant.trial_ends_at,
      trialDaysLeft,
      planExpiresAt: tenant.plan_expires_at,
      hasPaymentMethod: !!tenant.stripe_customer_id,
      limits: effective === 'free' ? FREE_LIMITS : null,
    });
  });

  // POST /billing/checkout — cria sessão Stripe Checkout
  app.post('/checkout', { preHandler: [authGuard] }, async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const userId = (request as any).userId;
    const body = request.body as { interval?: 'month' | 'year' };
    const interval = body?.interval ?? 'month';

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripe_customer_id: true, plan: true, plan_status: true },
    });

    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

    if (tenant.plan === 'pro' && tenant.plan_status === 'active') {
      return reply.status(400).send({ error: 'already_subscribed' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    // Criar/recuperar customer
    let customerId = tenant.stripe_customer_id;
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user?.email,
        metadata: { tenantId, userId },
      });
      customerId = customer.id;
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { stripe_customer_id: customerId },
      });
    }

    const priceId = interval === 'year' ? STRIPE_PRICES.proAnnual : STRIPE_PRICES.proMonthly;

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { tenantId },
      },
      success_url: `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/upgrade?canceled=true`,
      metadata: { tenantId },
      allow_promotion_codes: true,
      locale: 'pt-BR',
    });

    return reply.send({ checkoutUrl: session.url, sessionId: session.id });
  });

  // POST /billing/portal — portal Stripe para gerenciar assinatura
  app.post('/portal', { preHandler: [authGuard] }, async (request, reply) => {
    const tenantId = (request as any).tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripe_customer_id: true },
    });

    if (!tenant?.stripe_customer_id) {
      return reply.status(400).send({ error: 'no_subscription' });
    }

    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: `${APP_URL}/settings`,
    });

    return reply.send({ portalUrl: portalSession.url });
  });

  // POST /billing/webhook — recebe eventos do Stripe
  // ATENÇÃO: não usar authGuard aqui
  app.post('/webhook', async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(
        (request as any).rawBody ?? JSON.stringify(request.body),
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      app.log.error({ err }, 'Stripe webhook signature error');
      return reply.status(400).send({ error: 'Invalid signature' });
    }

    app.log.info(`[Billing] Webhook: ${event.type}`);
    await handleStripeEvent(event, app);
    return reply.send({ received: true });
  });
}

// ── Handlers de eventos Stripe ────────────────────────────────────────────────

// Extrai ID de subscription de uma Invoice (Stripe v20: via parent.subscription_details)
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = (invoice as any).parent;
  if (parent?.subscription_details?.subscription) {
    const sub = parent.subscription_details.subscription;
    return typeof sub === 'string' ? sub : sub.id;
  }
  // fallback para versões anteriores
  const legacySub = (invoice as any).subscription;
  if (legacySub) return typeof legacySub === 'string' ? legacySub : legacySub.id;
  return null;
}

async function handleStripeEvent(event: Stripe.Event, app: FastifyInstance) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      if (!tenantId || !session.subscription) break;
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
      const sub = await getStripe().subscriptions.retrieve(subId);
      await updateTenantFromSubscription(tenantId, sub);
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      if (!tenantId) break;
      await updateTenantFromSubscription(tenantId, sub);
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = getInvoiceSubscriptionId(invoice);
      if (!subId) break;
      const sub = await getStripe().subscriptions.retrieve(subId);
      const tenantId = sub.metadata?.tenantId;
      if (!tenantId) break;
      await updateTenantFromSubscription(tenantId, sub);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = getInvoiceSubscriptionId(invoice);
      if (!subId) break;
      const sub = await getStripe().subscriptions.retrieve(subId);
      const tenantId = sub.metadata?.tenantId;
      if (!tenantId) break;
      await prisma.tenant.updateMany({
        where: { id: tenantId },
        data: { plan_status: 'past_due' },
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      if (!tenantId) break;
      // current_period_end is on sub.items.data[0] in Stripe v20
      const periodEnd = getPeriodEnd(sub);
      await prisma.tenant.updateMany({
        where: { id: tenantId },
        data: {
          plan: 'free',
          plan_status: 'canceled',
          stripe_sub_id: null,
          plan_expires_at: periodEnd,
        },
      });
      break;
    }

    default:
      app.log.debug(`[Billing] Unhandled webhook event: ${event.type}`);
  }
}

// current_period_end foi movido para SubscriptionItem em Stripe v20
function getPeriodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0];
  if (item && typeof (item as any).current_period_end === 'number') {
    return new Date((item as any).current_period_end * 1000);
  }
  return null;
}

async function updateTenantFromSubscription(tenantId: string, sub: Stripe.Subscription) {
  const plan = sub.status === 'canceled' ? 'free' : 'pro';
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
  const periodEnd = getPeriodEnd(sub);

  await prisma.tenant.updateMany({
    where: { id: tenantId },
    data: {
      plan,
      plan_status: sub.status,
      trial_ends_at: trialEnd,
      plan_expires_at: periodEnd,
      stripe_sub_id: sub.id,
    },
  });
}
