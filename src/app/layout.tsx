import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Inter, Instrument_Serif, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter-loaded",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LEVERAGE — You name the job. We lock the price.",
  description:
    "One job. Three shops. One clear pick. Agents negotiate in parallel so you get the best deal without phone tag.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrument.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="flex min-h-full flex-col text-[var(--ink)]"
        style={
          {
            fontFamily: "var(--font-inter-loaded), Inter, system-ui, sans-serif",
            ["--font-inter" as string]:
              "var(--font-inter-loaded), Inter, system-ui, sans-serif",
            ["--font-logo" as string]:
              "var(--font-instrument), 'Instrument Serif', Georgia, serif",
          } as CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
