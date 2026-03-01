import type { Metadata, Viewport } from "next";
import { Orbitron, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import "./globals.css";
import { QueryProvider } from "./providers"; // TanStack Query (React Query) provider
import { SentryStub } from "@/components/sentry-stub"; // Phase 29: error tracking stub (replace with @sentry/nextjs when DSN set)

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SILS — Student Information and Learning System",
  description:
    "AI-native multi-tenant SaaS combining LMS and optional unified SIS.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SILS",
  },
};

export const viewport: Viewport = {
  themeColor: "#030014",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInForceRedirectUrl="/auth/callback"
      signUpForceRedirectUrl="/onboarding"
    >
      <html lang="en" className={`${orbitron.variable} ${jetbrainsMono.variable}`}>
        <body className="antialiased min-h-screen bg-space-950 text-slate-100 font-sans">
          <SentryStub />
          <QueryProvider>{children}</QueryProvider>
          <Toaster
            theme="dark"
            position="top-right"
            richColors
            closeButton
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
