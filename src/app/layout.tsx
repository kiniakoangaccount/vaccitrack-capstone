import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
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
  return <html lang="en"><body className={`${bodyFont.variable} ${displayFont.variable}`}>{children}</body></html>;
}
