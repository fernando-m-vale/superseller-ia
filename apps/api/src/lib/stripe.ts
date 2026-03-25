import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2026-02-25.clover', typescript: true });
  }
  return _stripe;
}

export const STRIPE_PRICES = {
  proMonthly: process.env.STRIPE_PRO_PRICE_MONTHLY!,
  proAnnual: process.env.STRIPE_PRO_PRICE_ANNUAL!,
};

export const TRIAL_DAYS = parseInt(process.env.STRIPE_TRIAL_DAYS ?? '14');
export const APP_URL = process.env.APP_URL ?? 'https://app.superselleria.com.br';
