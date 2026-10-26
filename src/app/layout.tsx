import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRISM — Motion Graphics & Design Studio with BYO-AI Agent",
  description:
    "Prism is a professional motion graphics editor and graphic design platform with a true AI agent that plans, selects tools, edits your canvas and renders previews — powered by your own API keys (OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek and more).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800&family=Bebas+Neue&family=DM+Sans:wght@400;500;700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&family=Montserrat:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,500;0,700;1,600&family=Poppins:wght@400;600;700&family=Sora:wght@400;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
