/**
 * Finance module role checks. Scoped roles: Finance Officer (view/process), Finance Director (approve/reject).
 * OWNER and ADMIN have full finance access.
 */

import type { UserRole } from "@prisma/client";

/** Can view finance dashboards, applications list, invoices, payments. */
export function canAccessFinance(role: UserRole | string): boolean {
  return (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "FINANCE_OFFICER" ||
    role === "FINANCE_DIRECTOR"
  );
}

/** Can approve or reject financial aid applications (final decision). */
export function canApproveAid(role: UserRole | string): boolean {
  return (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "FINANCE_DIRECTOR"
  );
}

/** Can run AI recommendation (ProcessFinancialAid) and create draft awards. */
export function canProcessAid(role: UserRole | string): boolean {
  return canAccessFinance(role);
}
