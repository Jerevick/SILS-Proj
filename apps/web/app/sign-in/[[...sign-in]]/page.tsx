import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-space-950 px-4">
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
            borderRadius: "0.75rem",
          },
        }}
        afterSignInUrl="/auth/callback"
        signUpUrl="/sign-up"
      />
    </div>
  );
}
