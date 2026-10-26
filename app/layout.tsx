import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { ThemeProvider, THEME_SCRIPT } from '@/lib/hooks/use-theme';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GOOGLE_FONTS_HREF } from '@/lib/data/library';
import './globals.css';

export const metadata: Metadata = {
  title: 'Prism — Motion & Design Studio with an AI Agent',
  description: 'Prism is a browser-based motion graphics editor, graphic design suite, and autonomous AI creative agent. Bring your own AI provider keys.',
  applicationName: 'Prism',
  authors: [{ name: 'Prism Studio' }],
  keywords: ['motion graphics', 'design tool', 'AI agent', 'BYO AI', 'keyframes', 'timeline', 'design platform'],
  openGraph: { title: 'Prism — Motion & Design Studio', description: 'Design, animate, and delegate to an AI agent that builds real projects.', type: 'website' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#0b0b12' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={GOOGLE_FONTS_HREF} rel="stylesheet" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <TooltipProvider delayDuration={250} skipDelayDuration={200}>
            {children}
            <Toaster
              position="bottom-right"
              closeButton
              toastOptions={{
                classNames: {
                  toast: 'glass-strong !rounded-xl !border-border !text-foreground !text-xs',
                  description: '!text-muted-foreground',
                },
              }}
            />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
