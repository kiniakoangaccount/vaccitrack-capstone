import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import ThemeToggle from "@/app/_components/shared/ThemeToggle";
import "./globals.css";

const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body" });
const displayFont = Inter({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "VacciTrack | Animal Health Monitor",
  description: "A focused vaccination monitoring dashboard for barangay field teams.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body className={`${bodyFont.variable} ${displayFont.variable}`}><Script id="theme-bootstrap" strategy="beforeInteractive">{`try { document.documentElement.dataset.theme = localStorage.getItem("vaccitrack-theme") === "dark" ? "dark" : "light"; } catch { document.documentElement.dataset.theme = "light"; }`}</Script><ThemeToggle />{children}</body></html>;
}
