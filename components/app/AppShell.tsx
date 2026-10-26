'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, ArrowUpRight, FolderOpen, LayoutTemplate, Palette, Settings2, Sparkles, Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { PrismLogo } from '@/components/brand/PrismLogo';
import { useTheme } from '@/lib/hooks/use-theme';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/dashboard', label: 'Projects', icon: FolderOpen },
  { href: '/dashboard?tab=templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/dashboard?tab=brand', label: 'Brand kits', icon: Palette },
  { href: '/dashboard?tab=activity', label: 'Activity', icon: Activity },
  { href: '/settings/ai', label: 'AI providers', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

export function AppShell({ children, title, subtitle, actions }: { children: React.ReactNode; title: string; subtitle?: string; actions?: React.ReactNode }) {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  useEffect(() => { setSearch(window.location.search); }, [pathname]);
  const { theme, resolved, setTheme } = useTheme();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="sticky top-0 hidden h-screen w-[212px] shrink-0 flex-col border-r border-border/70 bg-panel/50 px-2.5 py-3 md:flex">
        <Link href="/" className="mb-4 flex items-center gap-2 px-1.5">
          <PrismLogo className="h-6 w-6" />
          <span className="prism-text text-[14px] font-semibold tracking-tight">Prism</span>
          <span className="ml-auto rounded border border-border/70 px-1 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground">Studio</span>
        </Link>

        <nav className="space-y-0.5">
          {NAV.map((item) => {
            const [base, query] = item.href.split('?');
            const active = pathname === base && (!query || search.includes(query));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11.5px] transition-colors',
                  active ? 'bg-violet-500/12 text-violet-200 ring-1 ring-inset ring-violet-400/20' : 'text-foreground/65 hover:bg-white/[0.04] hover:text-foreground',
                )}
              >
                <item.icon className="h-3.5 w-3.5" /> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 rounded-xl border border-violet-400/20 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(124,58,237,.18),transparent_60%)] p-2.5">
          <p className="flex items-center gap-1 text-[10.5px] font-medium text-violet-100"><Sparkles className="h-3 w-3" /> Agent ready</p>
          <p className="mt-0.5 text-[9.5px] leading-relaxed text-muted-foreground">Bring your own model — 11 providers, encrypted keys, real tool calling.</p>
          <Link href="/settings/ai" className="mt-1.5 flex items-center gap-1 text-[9.5px] font-medium text-violet-300 hover:text-violet-200">
            Manage providers <ArrowUpRight className="h-2.5 w-2.5" />
          </Link>
        </div>

        <div className="mt-auto space-y-1.5">
          <div className="flex items-center gap-1 rounded-lg border border-border/60 p-0.5">
            {([['dark', Moon], ['light', Sun], ['system', MonitorSmartphone]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                className={cn('grid h-6 flex-1 place-items-center rounded-md transition-colors', theme === mode ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground')}
                aria-label={`${mode} theme`}
              >
                <Icon className="h-3 w-3" />
              </button>
            ))}
          </div>
          <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-[9px] font-bold text-black/80">P</span>
            <div className="min-w-0">
              <p className="truncate text-[10.5px] font-medium">Local workspace</p>
              <p className="truncate text-[9px] text-muted-foreground">guest · {resolved} theme</p>
            </div>
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/70 bg-background/80 px-5 py-3 backdrop-blur-xl md:px-7">
          <Link href="/" className="flex items-center gap-2 md:hidden"><PrismLogo className="h-5 w-5" /></Link>
          <div className="min-w-0">
            <h1 className="truncate text-[16px] font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="truncate text-[10.5px] text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {actions}
            <Button asChild size="sm" variant="prism" className="h-8">
              <Link href={`/editor/new-${Math.random().toString(36).slice(2, 7)}`}>New project</Link>
            </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-5 py-4 md:px-7">{children}</main>
      </div>
    </div>
  );
}
