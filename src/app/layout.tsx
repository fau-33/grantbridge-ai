import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "GrantBridge AI — Financiamento Climático Global para o Brasil",
  description:
    "Conectando pequenas ONGs, cooperativas e iniciativas ambientais locais do Brasil a fundos e editais climáticos internacionais com IA.",
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
