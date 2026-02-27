import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-space-950 px-4">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-slate-900/80 border border-white/10 shadow-xl",
          },
          variables: {
            colorPrimary: "#00f5ff",
            colorBackground: "#0f172a",
            colorText: "#e2e8f0",
            colorInputBackground: "#1e293b",
            colorInputForeground: "#f1f5f9",
            borderRadius: "0.75rem",
          },
        }}
        afterSignInUrl="/auth/callback"
        signUpUrl="/sign-up"
      />
      <p className="mt-4 text-center text-slate-400 text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="text-neon-cyan hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
