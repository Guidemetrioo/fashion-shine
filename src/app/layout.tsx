import type { Metadata } from "next";
import { Playfair_Display, Outfit } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fashion Shine | Luxury Fashion Boutique",
  description: "Explore the exclusive collection of luxury clothing, dresses, outerwear, and accessories at Fashion Shine. Elevate your style with timeless elegance.",
  keywords: ["fashion", "luxury", "boutique", "clothing", "dresses", "exclusive fashion", "online boutique"],
  authors: [{ name: "Fashion Shine" }],
  openGraph: {
    title: "Fashion Shine | Luxury Fashion Boutique",
    description: "Explore the exclusive collection of luxury clothing at Fashion Shine.",
    url: "https://fashionshine.com",
    siteName: "Fashion Shine",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${outfit.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body>{children}</body>
    </html>
  );
}
