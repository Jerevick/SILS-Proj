import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "./providers";

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
  themeColor: "#0f172a",
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
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-950 text-slate-100">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
