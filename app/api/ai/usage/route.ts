import { ensureUserId } from '@/lib/server/session';
import { getUser } from '@/lib/server/store';
import { getProvider } from '@/lib/ai/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = ensureUserId();
  const user = await getUser(userId);
  const usage = user.usage ?? [];
  const byProvider = new Map<string, { provider: string; name: string; requests: number; tokensIn: number; tokensOut: number; cost: number }>();
  for (const u of usage) {
    const cur = byProvider.get(u.provider) ?? { provider: u.provider, name: getProvider(u.provider)?.name ?? u.provider, requests: 0, tokensIn: 0, tokensOut: 0, cost: 0 };
    cur.requests += 1; cur.tokensIn += u.tokensIn ?? 0; cur.tokensOut += u.tokensOut ?? 0; cur.cost += u.cost ?? 0;
    byProvider.set(u.provider, cur);
  }
  return Response.json({
    totals: {
      requests: usage.length,
      tokensIn: usage.reduce((a, u) => a + (u.tokensIn ?? 0), 0),
      tokensOut: usage.reduce((a, u) => a + (u.tokensOut ?? 0), 0),
      cost: usage.reduce((a, u) => a + (u.cost ?? 0), 0),
    },
    byProvider: [...byProvider.values()].sort((a, b) => b.cost - a.cost),
    runs: (user.runs ?? []).slice(0, 40),
    recent: usage.slice(-40).reverse(),
  });
}
