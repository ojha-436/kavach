import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kavach — know what's void before you sign",
  description:
    "Clause-level analysis of Indian rental agreements and employment offer letters. Every verdict cites a statute. Legal information, not legal advice.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
