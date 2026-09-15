import type { Metadata } from "next";
import { Spectral, IBM_Plex_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});

// One family covering Latin and Devanagari, so "कवच" and "Kavach" are set
// in the same voice rather than two mismatched faces.
const plex = IBM_Plex_Sans_Devanagari({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kavach — know what's void before you sign",
  description:
    "Clause-level analysis of Indian rental agreements and employment offer letters, and plain-English explanations of Supreme Court judgments. Every claim cites its source. Legal information, not legal advice.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${spectral.variable} ${plex.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
