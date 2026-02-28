/**
 * GET /api/finance/invoices — List invoices for the tenant.
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

  const list = await prisma.invoice.findMany({
    where: { tenantId: tenantResult.context.tenantId },
    include: {
      payments: { select: { id: true, amount: true, method: true, date: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = list.map((i) => ({
    id: i.id,
    studentId: i.studentId,
    amount: Number(i.amount),
    dueDate: i.dueDate.toISOString(),
    status: i.status,
    items: i.items as Array<{ description: string; amount: number; quantity?: number }>,
    stripePaymentLinkUrl: i.stripePaymentLinkUrl,
    payments: i.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      date: p.date.toISOString(),
    })),
    createdAt: i.createdAt.toISOString(),
  }));

  return NextResponse.json({ invoices: rows });
}
