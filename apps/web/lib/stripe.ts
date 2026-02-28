/**
 * Stripe server-side client for SILS onboarding payments.
 * Used to create Checkout Sessions and verify webhooks.
 */

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
export const stripeEnabled = Boolean(secretKey?.startsWith("sk_"));

export const stripe = stripeEnabled ? new Stripe(secretKey!) : null;

/** Convert decimal amount string to Stripe smallest currency unit (cents). */
export function toStripeAmount(amountStr: string, currency: string): number {
  const cleaned = String(amountStr).replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  if (Number.isNaN(num) || num < 0) return 0;
  // Zero-decimal currencies (JPY, KRW, etc.) use whole units
  const zeroDecimal = ["jpy", "krw", "vnd", "clp", "xof", "xaf", "xpf"].includes(
    currency.toLowerCase()
  );
  return zeroDecimal ? Math.round(num) : Math.round(num * 100);
}

/**
 * Payment method types for Checkout. Start with card + link (supported on all accounts).
 * Enable more in Stripe Dashboard (Settings → Payment methods) and add them here if desired.
 * Stripe will reject the request if a type isn't enabled for your account or currency.
 */
export const CHECKOUT_PAYMENT_METHOD_TYPES: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = [
  "card",  // Cards, Link, Apple Pay, Google Pay when available
  "link",
];
