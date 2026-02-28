import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-space-950 px-4">
      <SignUp
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
        afterSignUpUrl="/onboarding"
        signInUrl="/sign-in"
      />
    </div>
  );
}
