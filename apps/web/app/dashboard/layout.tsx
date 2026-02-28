"use client";

import { TermsGuard } from "@/app/components/terms-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TermsGuard>{children}</TermsGuard>;
}
