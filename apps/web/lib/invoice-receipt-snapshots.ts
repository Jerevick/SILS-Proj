/**
 * Snapshot types and builders for invoice and receipt.
 * Snapshots are stored when the invoice is sent or payment is confirmed, so we always
 * serve the exact document as it was at that time (audit/reference).
 */

const SNAPSHOT_VERSION = 1;

export type InvoiceSnapshotRequest = {
  id: string;
  institutionName: string;
  deploymentMode: string;
  contactPerson: string;
  contactEmail: string;
  quotationInvoiceNumber: string | null;
  quotationSentAt: string | null;
};

export type InvoiceSnapshotSettings = {
  pricingPlans: Record<string, Record<string, unknown>>;
  paymentTerms: { defaultTerms: string; dueDays: number; latePolicy: string };
  bankDetails: {
    bankName: string;
    bban: string;
    swift: string;
    accountMasked: string;
    referenceFormat: string;
    instructions: string;
  };
  taxCompliance: Record<string, unknown>;
};

export type InvoiceSnapshot = {
  version: number;
  sentAt: string;
  request: InvoiceSnapshotRequest;
  settings: InvoiceSnapshotSettings;
};

export type ReceiptSnapshotRequest = {
  id: string;
  institutionName: string;
  deploymentMode: string;
  contactPerson: string;
  contactEmail: string;
  quotationInvoiceNumber: string | null;
  paidAt: string;
  amount: string;
  currency: string;
};

export type ReceiptSnapshot = {
  version: number;
  paidAt: string;
  request: ReceiptSnapshotRequest;
};

function isInvoiceSnapshot(v: unknown): v is InvoiceSnapshot {
  return (
    typeof v === "object" &&
    v !== null &&
    "version" in v &&
    (v as InvoiceSnapshot).version === SNAPSHOT_VERSION &&
    "request" in v &&
    "settings" in v &&
    "sentAt" in v
  );
}

function isReceiptSnapshot(v: unknown): v is ReceiptSnapshot {
  return (
    typeof v === "object" &&
    v !== null &&
    "version" in v &&
    (v as ReceiptSnapshot).version === SNAPSHOT_VERSION &&
    "request" in v &&
    "paidAt" in v
  );
}

export function buildInvoiceSnapshot(
  request: {
    id: string;
    institutionName: string;
    deploymentMode: string;
    contactPerson: string;
    contactEmail: string;
    quotationInvoiceNumber: string | null;
    quotationSentAt: Date | null;
  },
  settings: InvoiceSnapshotSettings,
  sentAt: Date
): InvoiceSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    sentAt: sentAt.toISOString(),
    request: {
      id: request.id,
      institutionName: request.institutionName,
      deploymentMode: request.deploymentMode,
      contactPerson: request.contactPerson,
      contactEmail: request.contactEmail,
      quotationInvoiceNumber: request.quotationInvoiceNumber,
      quotationSentAt: request.quotationSentAt?.toISOString() ?? null,
    },
    settings: {
      pricingPlans: { ...settings.pricingPlans },
      paymentTerms: { ...settings.paymentTerms },
      bankDetails: { ...settings.bankDetails },
      taxCompliance: { ...settings.taxCompliance },
    },
  };
}

export function buildReceiptSnapshot(
  request: {
    id: string;
    institutionName: string;
    deploymentMode: string;
    contactPerson: string;
    contactEmail: string;
    quotationInvoiceNumber: string | null;
  },
  amount: string,
  currency: string,
  paidAt: Date
): ReceiptSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    paidAt: paidAt.toISOString(),
    request: {
      id: request.id,
      institutionName: request.institutionName,
      deploymentMode: request.deploymentMode,
      contactPerson: request.contactPerson,
      contactEmail: request.contactEmail,
      quotationInvoiceNumber: request.quotationInvoiceNumber,
      paidAt: paidAt.toISOString(),
      amount,
      currency,
    },
  };
}

export function parseInvoiceSnapshot(raw: unknown): InvoiceSnapshot | null {
  if (!isInvoiceSnapshot(raw)) return null;
  return raw;
}

export function parseReceiptSnapshot(raw: unknown): ReceiptSnapshot | null {
  if (!isReceiptSnapshot(raw)) return null;
  return raw;
}
