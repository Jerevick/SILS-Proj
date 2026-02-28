"use client";

/**
 * Redirect /progress/me to /progress/[currentUserId] for the logged-in student.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

export default function ProgressMePage() {
  const router = useRouter();
  const { userId, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    if (userId) {
      router.replace(`/progress/${userId}`);
    } else {
      router.replace("/student/dashboard");
    }
  }, [isLoaded, userId, router]);

  return (
    <div className="min-h-[20vh] flex items-center justify-center text-slate-400 text-sm">
      Redirecting…
    </div>
  );
}
