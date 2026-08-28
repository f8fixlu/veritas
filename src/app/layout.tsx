import type { Metadata } from "next";
import "./globals.css";
import SessionMonitor from "@/components/session-monitor";

export const metadata: Metadata = {
  title: "Veritas — Online Examination System",
  description:
    "A simple and elegant online examination system with timed exams, subject enrollment and instant results.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-800 antialiased">
        {children}
        <SessionMonitor />
      </body>
    </html>
  );
}
