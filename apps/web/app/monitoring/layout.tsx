import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { hasPlatformAccess } from "@/lib/platform-auth";

export default async function MonitoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  const allowed = await hasPlatformAccess(userId ?? null);
  if (!allowed) redirect("/admin/dashboard");
  return <>{children}</>;
}
