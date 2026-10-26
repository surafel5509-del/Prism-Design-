import Link from 'next/link';
import { ArrowUpRight, KeyRound, Palette, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { AppShell } from '@/components/app/AppShell';

const CARDS = [
  { href: '/settings/ai', title: 'AI providers & models', body: 'Connect OpenAI, Anthropic, Google, OpenRouter, Groq, DeepSeek or any OpenAI-compatible endpoint. Keys are encrypted with AES-256-GCM.', icon: KeyRound, accent: 'from-violet-500/25 to-fuchsia-500/10' },
  { href: '/dashboard?tab=brand', title: 'Brand kits', body: 'Colors, type and logo systems that flow into every design and into the agent’s brief.', icon: Palette, accent: 'from-cyan-500/25 to-violet-500/10' },
  { href: '/settings/ai#usage', title: 'Usage & cost', body: 'Per-provider requests, tokens and estimated spend, with the last 40 agent runs.', icon: Sparkles, accent: 'from-fuchsia-500/25 to-cyan-500/10' },
  { href: '/dashboard?tab=activity', title: 'Account & workspace', body: 'Local-first guest identity with cookie sessions. Swap in Supabase or Clerk for team auth — see the deployment guide.', icon: Users, accent: 'from-emerald-500/20 to-cyan-500/10' },
];

export default function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Workspace, AI and appearance">
      <div className="grid gap-3 md:grid-cols-2">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="group relative overflow-hidden rounded-2xl border border-border/70 bg-white/[0.02] p-4 transition-colors hover:border-violet-400/30 hover:bg-white/[0.035]">
            <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${c.accent} blur-2xl transition-transform group-hover:scale-110`} />
            <div className="relative">
              <span className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/[0.04]"><c.icon className="h-4 w-4 text-foreground/80" /></span>
              <p className="mt-2 text-[13px] font-medium tracking-tight">{c.title}</p>
              <p className="mt-1 max-w-[360px] text-[10.5px] leading-relaxed text-muted-foreground">{c.body}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-violet-300">Open <ArrowUpRight className="h-2.5 w-2.5" /></span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-400" />
        <div>
          <p className="text-[11.5px] font-medium text-emerald-100">Secrets never touch the browser</p>
          <p className="mt-0.5 max-w-[640px] text-[10.5px] leading-relaxed text-muted-foreground">
            API keys are encrypted server-side, stored as AES-256-GCM boxes, and only ever returned to this UI as a masked preview. All model calls — chat, vision, image and speech — are proxied through Prism&rsquo;s API routes.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
