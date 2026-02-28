/**
 * Generate a secure random password and send "user created" emails with credentials.
 * Used when creating new users (platform staff or institution) so they get a temp password by email.
 */

import { randomBytes } from "node:crypto";

const APP_LOGIN_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

/** Generate a password that meets Clerk's rules (min 8 chars, not in breached list). */
export function generateSecurePassword(): string {
  const chars =
    "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%&*";
  const bytes = randomBytes(16);
  let s = "";
  for (let i = 0; i < 14; i++) s += chars[bytes[i]! % chars.length];
  return s;
}

/** Generate a unique username from email (for Clerk instances that require username). */
export function usernameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "user";
  const safe = local.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20) || "user";
  return `${safe}_${randomBytes(4).toString("hex")}`;
}

async function sendResendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ sent: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log("[SILS] Email skipped (RESEND_API_KEY not set).", subject);
    return { sent: false, error: "RESEND_API_KEY not set" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "SILS <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      let message = `Resend ${res.status}`;
      try {
        const data = JSON.parse(text) as { message?: string };
        if (data.message) message = data.message;
      } catch {
        message = text || message;
      }
      if (res.status === 403 && /only send testing emails to your own|verify a domain/i.test(message)) {
        const hint =
          "On Resend's free tier you can only send to your own email. To send to others, verify a domain at https://resend.com/domains and set RESEND_FROM_EMAIL to an address on that domain.";
        console.warn("[SILS] Resend 403:", message, "\n→", hint);
        return { sent: false, error: hint };
      }
      console.error("Resend API error:", res.status, text);
      return { sent: false, error: message };
    }
    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Send email error:", err);
    return { sent: false, error: msg };
  }
}

export type PlatformStaffCreatedEmailParams = {
  to: string;
  recipientName?: string;
  role: string;
  tempPassword: string;
};

/** Email when a new platform staff user is created with a temp password. */
export async function sendPlatformStaffCreatedEmail(
  params: PlatformStaffCreatedEmailParams
): Promise<{ sent: boolean; error?: string }> {
  const { to, recipientName, role, tempPassword } = params;
  const name = recipientName || "there";
  const loginUrl = `${APP_LOGIN_URL}/sign-in`;
  const html = `
    <p>Hi ${name},</p>
    <p>You have been added as <strong>${role}</strong> to the SILS platform admin area.</p>
    <p>Your temporary password:</p>
    <p><code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;">${tempPassword}</code></p>
    <p>Sign in here: <a href="${loginUrl}">${loginUrl}</a></p>
    <p>Use your email and the password above. We recommend changing your password after first sign-in (account settings).</p>
    <p>— The SILS Team</p>
  `;
  return sendResendEmail(to, "Your SILS platform admin access", html);
}

/** Email when an existing user is added as platform staff (no temp password). */
export async function sendPlatformStaffAddedEmail(params: {
  to: string;
  role: string;
}): Promise<{ sent: boolean; error?: string }> {
  const { to, role } = params;
  const loginUrl = `${APP_LOGIN_URL}/sign-in`;
  const adminUrl = `${APP_LOGIN_URL}/admin/dashboard`;
  const html = `
    <p>Hi,</p>
    <p>You have been added as <strong>${role}</strong> to the SILS platform admin area.</p>
    <p>Sign in with your existing account here: <a href="${loginUrl}">${loginUrl}</a></p>
    <p>After signing in, you can access the admin dashboard: <a href="${adminUrl}">${adminUrl}</a></p>
    <p>— The SILS Team</p>
  `;
  return sendResendEmail(to, "You've been added as SILS platform staff", html);
}

export type OnboardingRequestAcknowledgementParams = {
  to: string;
  recipientName: string;
  institutionName: string;
};

/** Email acknowledging receipt of an institution onboarding request. */
export async function sendOnboardingRequestAcknowledgementEmail(
  params: OnboardingRequestAcknowledgementParams
): Promise<{ sent: boolean; error?: string }> {
  const { to, recipientName, institutionName } = params;
  const html = `
    <p>Hi ${recipientName},</p>
    <p>We have received your onboarding request for <strong>${institutionName}</strong>.</p>
    <p>Our team will review it and get back to you at this email address once your institution has been approved. You will then receive a separate email with next steps to access your SILS dashboard.</p>
    <p>If you have any questions in the meantime, please reply to this email.</p>
    <p>— The SILS Team</p>
  `;
  return sendResendEmail(to, "We've received your SILS onboarding request", html);
}

export type InstitutionUserCreatedEmailParams = {
  to: string;
  recipientName: string;
  institutionName: string;
  tempPassword: string;
  institutionUrl: string;
  dashboardUrl: string;
  termsUrl: string;
};

/** Email when a new institution user is created (onboarding approved) with a temp password. */
export async function sendInstitutionUserCreatedEmail(
  params: InstitutionUserCreatedEmailParams
): Promise<void> {
  const { to, recipientName, institutionName, tempPassword, institutionUrl, dashboardUrl, termsUrl } = params;
  const loginUrl = APP_LOGIN_URL + "/sign-in";
  const html = `
    <p>Hi ${recipientName},</p>
    <p>Your institution <strong>${institutionName}</strong> has been approved for SILS.</p>
    <p><strong>Your institution's unique URL:</strong></p>
    <p><a href="${institutionUrl}">${institutionUrl}</a></p>
    <p>Save or bookmark this link — it is the permanent URL for your institution.</p>
    <p><strong>Before you can access the platform</strong>, you must read and accept our Terms and Conditions:</p>
    <p><a href="${termsUrl}">Accept Terms and Conditions</a></p>
    <p>A sign-in account has been created for you.</p>
    <p>Your temporary password:</p>
    <p><code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;">${tempPassword}</code></p>
    <p>Sign in here: <a href="${loginUrl}">${loginUrl}</a></p>
    <p>After accepting the terms and signing in with your email and the password above, you can access your dashboard:</p>
    <p><a href="${dashboardUrl}">${dashboardUrl}</a></p>
    <p>We recommend changing your password after first sign-in (account settings).</p>
    <p>— The SILS Team</p>
  `;
  await sendResendEmail(to, "Welcome to SILS — Your institution is approved", html);
}

export type OnboardingQuotationEmailParams = {
  to: string;
  recipientName: string;
  institutionName: string;
  deploymentMode: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
  paymentUrl?: string;
  termsUrl?: string;
};

/** Email sending onboarding quotation/invoice to institution contact. */
export async function sendOnboardingQuotationEmail(
  params: OnboardingQuotationEmailParams
): Promise<{ sent: boolean; error?: string }> {
  const { to, recipientName, institutionName, deploymentMode, invoiceNumber, invoiceUrl, paymentUrl, termsUrl } = params;
  const modeLabel = deploymentMode === "SIS" ? "SIS" : deploymentMode === "HYBRID" ? "Hybrid (SIS + LMS)" : "LMS";
  const invoiceLine = invoiceNumber ? `<p><strong>Invoice number:</strong> ${invoiceNumber}</p>` : "";
  const pdfLine =
    invoiceUrl
      ? `<p><strong>View and download your invoice (PDF):</strong><br /><a href="${invoiceUrl}" style="color: #0066cc;">${invoiceUrl}</a></p>
    <p>Open the link above to view your invoice. Use your browser&rsquo;s <strong>Print</strong> menu and choose <strong>Save as PDF</strong> to download a PDF copy for your records.</p>`
      : "";
  const paymentLine =
    paymentUrl
      ? `<p><strong>Pay online (full amount required):</strong><br /><a href="${paymentUrl}" style="color: #0066cc; font-weight: bold;">${paymentUrl}</a></p>
    <p>Use this unique link to view the amount due and complete payment. The payment page will show the exact amount; partial payments are not accepted.</p>`
      : "";
  const termsLine =
    termsUrl
      ? `<p><strong>Terms and conditions (applicable to your deployment):</strong><br /><a href="${termsUrl}" style="color: #0066cc;">${termsUrl}</a></p>
    <p>This link opens the SILS terms and conditions that apply to your chosen deployment mode (${modeLabel}). We recommend reviewing them before payment.</p>`
      : "";
  const html = `
    <p>Hi ${recipientName},</p>
    <p>Thank you for your interest in SILS. Please find below the onboarding quotation for <strong>${institutionName}</strong>.</p>
    ${invoiceLine}
    ${pdfLine}
    ${paymentLine}
    ${termsLine}
    <p><strong>Deployment mode:</strong> ${modeLabel}</p>
    <p><strong>Onboarding quotation / invoice</strong></p>
    <p>This quotation covers platform onboarding and the first period of service. Payment is required before your institution can be activated.</p>
    <ul>
      <li>Platform setup and configuration</li>
      <li>Administrator and user provisioning</li>
      <li>Terms and conditions acceptance</li>
    </ul>
    <p><strong>Payment instructions:</strong></p>
    <p>Please complete payment as per the payment details provided separately (or contact your account manager). Once payment is received and verified, we will activate your institution and send you the link to accept our Terms and Conditions and access your dashboard.</p>
    <p>If you have any questions, please reply to this email.</p>
    <p>— The SILS Team</p>
  `;
  return sendResendEmail(to, `SILS onboarding quotation — ${institutionName}`, html);
}

export type PaymentConfirmationEmailParams = {
  to: string;
  recipientName: string;
  institutionName: string;
  invoiceNumber: string | null;
  receiptUrl: string;
  amount: string;
  currency: string;
  paidAt: string; // ISO date string
};

/**
 * Email sent immediately after successful payment (Stripe webhook).
 * Includes unique link to downloadable PDF receipt.
 */
export async function sendPaymentConfirmationEmail(
  params: PaymentConfirmationEmailParams
): Promise<{ sent: boolean; error?: string }> {
  const { to, recipientName, institutionName, invoiceNumber, receiptUrl, amount, currency, paidAt } = params;
  const paidDate = new Date(paidAt).toLocaleDateString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
  const invoiceLine = invoiceNumber ? `<p><strong>Invoice number:</strong> ${invoiceNumber}</p>` : "";
  const html = `
    <p>Hi ${recipientName},</p>
    <p>We have received your payment for <strong>${institutionName}</strong>.</p>
    <p><strong>Payment summary</strong></p>
    ${invoiceLine}
    <p><strong>Amount paid:</strong> ${currency} ${amount}</p>
    <p><strong>Date:</strong> ${paidDate}</p>
    <p><strong>Download your receipt (PDF):</strong></p>
    <p><a href="${receiptUrl}" style="color: #0066cc; font-weight: bold;">${receiptUrl}</a></p>
    <p>Open the link above to view your receipt. Use your browser&rsquo;s <strong>Print</strong> menu and choose <strong>Save as PDF</strong> to download a PDF copy for your records.</p>
    <p>Your onboarding request will now be reviewed. Once approved, you will receive a welcome email with access to your SILS dashboard.</p>
    <p>If you have any questions, please reply to this email.</p>
    <p>— The SILS Team</p>
  `;
  return sendResendEmail(to, "Payment received — SILS onboarding", html);
}

/** Plain-text body to HTML (escape and newlines to <br />). */
function bodyToHtml(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<div style="font-family: sans-serif; max-width: 600px; line-height: 1.5;">${escaped.replace(/\n/g, "<br />")}</div>`;
}

export type SendAdminEmailParams = {
  to: string;
  subject: string;
  body: string;
};

/**
 * Send an email from platform admin to an institution contact (or any recipient).
 * Used for ad-hoc communication from the request/institution management pages.
 */
export async function sendAdminEmail(
  params: SendAdminEmailParams
): Promise<{ sent: boolean; error?: string }> {
  const { to, subject, body } = params;
  const trimmedTo = to.trim().toLowerCase();
  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  if (!trimmedTo || !trimmedSubject || !trimmedBody) {
    return { sent: false, error: "To, subject, and message are required." };
  }
  const html = bodyToHtml(trimmedBody);
  return sendResendEmail(trimmedTo, trimmedSubject, html);
}
