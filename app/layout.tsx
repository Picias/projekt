import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import BottomNav from "@/components/bottom-nav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

// PWA: wygeneruj i wrzuć do folderu `public` pliki icon-192x192.png oraz icon-512x512.png.
export const metadata: Metadata = {
  title: "SEJM ON — Włącz się w decyzje",
  description:
    "Obywatelska aplikacja do śledzenia ustaw, obrad i głosowań w Sejmie RP.",
  applicationName: "SejmON",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SejmON",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    apple: "/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B132B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
