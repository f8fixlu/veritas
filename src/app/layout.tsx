import type { Metadata } from "next";
import "./globals.css";
import ScrollToTop from "@/components/scroll-to-top";
import SessionMonitor from "@/components/session-monitor";
import InstallPrompt from "@/components/install-prompt";

export const metadata: Metadata = {
  title: "Veritas",
  description:
    "A simple and elegant online examination system with timed exams, subject enrollment and instant results.",
  icons: {
    icon: [
      { url: "/icons/veritas-current.ico", sizes: "any", type: "image/x-icon" },
      { url: "/icons/veritas-current-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icons/veritas-current.ico",
    apple: [{ url: "/icons/veritas-current-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-800 antialiased">
        {children}
        <InstallPrompt />
        <ScrollToTop />
        <SessionMonitor />
      </body>
    </html>
  );
}
