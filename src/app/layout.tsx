import type { Metadata, Viewport } from "next";
import {
  JetBrains_Mono,
  Plus_Jakarta_Sans,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const SITE_URL = "https://grantbridge-ai-theta.vercel.app";
const SITE_NAME = "GrantBridge AI";
const SITE_TITLE = "GrantBridge AI — Financiamento Climático Global para o Brasil";
const SITE_DESCRIPTION =
  "Conectando pequenas ONGs, cooperativas e iniciativas ambientais locais do Brasil a fundos e editais climáticos internacionais com IA.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "GrantBridge AI",
    "Hack Brasil 2026",
    "financiamento climático",
    "editais internacionais",
    "fundos climáticos",
    "ONGs ambientais",
    "cooperativas",
    "economia verde",
    "Concept Note",
    "Gemini 2.5 Flash",
  ],
  authors: [{ name: "GrantBridge AI" }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "environment",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "pt_BR",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#050B08",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${spaceGrotesk.variable} ${plusJakartaSans.variable} ${jetBrainsMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full overflow-x-hidden bg-[#050B08] text-[#F3F7F4] font-sans selection:bg-[#20BD80]/30 selection:text-[#57DCA0]">
        {children}
      </body>
    </html>
  );
}
