import { searchStockServer } from '@/lib/server/assets';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const provider = (url.searchParams.get('provider') === 'pexels' ? 'pexels' : 'unsplash') as 'unsplash' | 'pexels';
  const { results, reason } = await searchStockServer(q, provider);
  return Response.json({ results, provider, reason, configured: !reason });
}
