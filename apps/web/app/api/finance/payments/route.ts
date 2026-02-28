/**
 * GET /api/finance/payments — List payments for the tenant (from all invoices).
 * Scoped: Finance Officer, Finance Director, OWNER, ADMIN.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { canAccessFinance } from "@/lib/finance-auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (!canAccessFinance(tenantResult.context.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const list = await prisma.payment.findMany({
    where: { invoice: { tenantId: tenantResult.context.tenantId } },
    include: { invoice: { select: { id: true, studentId: true } } },
    orderBy: { date: "desc" },
  });

  const rows = list.map((p) => ({
    id: p.id,
    invoiceId: p.invoiceId,
    studentId: p.invoice.studentId,
    amount: Number(p.amount),
    method: p.method,
    transactionId: p.transactionId,
    date: p.date.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }));

  return NextResponse.json({ payments: rows });
}
