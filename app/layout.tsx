import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import BottomNav from "@/components/bottom-nav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SEJM ON — Włącz się w decyzje",
  description:
    "Obywatelska aplikacja do śledzenia ustaw, obrad i głosowań w Sejmie RP.",
  applicationName: "SEJM ON",
};

export const viewport: Viewport = {
  themeColor: "#0B1B3D",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" className={inter.variable}>
      <body className="bg-navy-950 font-sans text-white antialiased">
        <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-navy-900 md:shadow-[0_0_80px_rgba(0,0,0,0.55)]">
          <main className="flex-1 pb-28">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
