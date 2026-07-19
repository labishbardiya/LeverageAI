import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter-loaded",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LeverageAI — The Negotiator",
  description:
    "AI voice agents that phone-shop and haggle vendor quotes with honest, evidence-backed leverage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="flex min-h-full flex-col text-[var(--color-ink)]"
        style={
          {
            fontFamily: "var(--font-inter-loaded), Inter, system-ui, sans-serif",
            ["--font-inter" as string]:
              "var(--font-inter-loaded), Inter, system-ui, sans-serif",
            ["--font-waldenburg" as string]:
              "var(--font-inter-loaded), Inter, system-ui, sans-serif",
          } as CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
