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
  title: "Leverage.AI — parallel deal negotiation",
  description:
    "Describe the job once. We match shops, negotiate with three providers in parallel, and hand you one clear recommendation.",
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
        className="flex min-h-full flex-col text-[var(--ink)]"
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
