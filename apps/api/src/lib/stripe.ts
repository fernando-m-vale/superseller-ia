import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
  typescript: true,
});

export const STRIPE_PRICES = {
  proMonthly: process.env.STRIPE_PRO_PRICE_MONTHLY!,
  proAnnual: process.env.STRIPE_PRO_PRICE_ANNUAL!,
};

export const TRIAL_DAYS = parseInt(process.env.STRIPE_TRIAL_DAYS ?? '14');
export const APP_URL = process.env.APP_URL ?? 'https://app.superselleria.com.br';
