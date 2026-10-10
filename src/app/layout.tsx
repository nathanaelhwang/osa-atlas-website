import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { AskDock } from "@/components/ask/AskDock";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const description = "Phenome-wide atlas of obstructive sleep apnea in 222,109 adults.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.osaatlas.com"),
  title: { default: "OSA Atlas", template: "%s | OSA Atlas" },
  description,
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "OSA Atlas",
    description,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="flex min-h-screen flex-col bg-canvas font-sans text-ink">
        <Suspense fallback={<div className="sticky top-0 z-50 h-12 border-b border-hairline bg-canvas" />}>
          <SiteNav />
        </Suspense>
        {children}
        <Suspense fallback={null}>
          <AskDock />
        </Suspense>
      </body>
    </html>
  );
}
