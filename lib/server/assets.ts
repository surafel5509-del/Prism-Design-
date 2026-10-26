import { promises as fs } from 'node:fs';
import path from 'node:path';

interface IconEntry { label: string; svg: string; tags: string[] }
let cache: Record<string, IconEntry> | null = null;

export async function iconIndex(): Promise<Record<string, IconEntry>> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'public', 'icon-library.json'), 'utf8');
    cache = JSON.parse(raw) as Record<string, IconEntry>;
  } catch { cache = {}; }
  return cache;
}

export async function searchIconsServer(query: string, limit = 40) {
  const all = await iconIndex();
  const q = query.trim().toLowerCase();
  const hits = Object.entries(all).filter(([name, e]) =>
    !q || name.toLowerCase().includes(q) || e.label.toLowerCase().includes(q) || e.tags.some((t) => t.startsWith(q)));
  const ranked = hits.sort(([an, ae], [bn, be]) => {
    const aExact = an.toLowerCase() === q ? 0 : ae.label.toLowerCase() === q ? 1 : 2;
    const bExact = bn.toLowerCase() === q ? 0 : be.label.toLowerCase() === q ? 1 : 2;
    return aExact - bExact || an.length - bn.length;
  });
  return ranked.slice(0, limit).map(([name, e]) => ({ name, label: e.label, svg: e.svg, tags: e.tags }));
}

export function iconSvgDataUrl(svgInner: string, color = '#ffffff', strokeWidth = 1.75, size = 512): string {
  const inner = svgInner.replace(/currentColor/g, color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface StockResult { id: string; thumb: string; full: string; author: string; provider: 'unsplash' | 'pexels'; alt: string }

export async function searchStockServer(query: string, provider: 'unsplash' | 'pexels' = 'unsplash', perPage = 12): Promise<{ results: StockResult[]; reason?: string }> {
  const clean = query.trim().slice(0, 120) || 'abstract';
  if (provider === 'pexels') {
    const key = process.env.PEXELS_API_KEY;
    if (!key) return { results: [], reason: 'PEXELS_API_KEY is not configured on the server.' };
    try {
      const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(clean)}&per_page=${perPage}&orientation=landscape`, { headers: { Authorization: key } });
      if (!r.ok) return { results: [], reason: `Pexels responded ${r.status}` };
      const data = await r.json();
      return {
        results: (data.photos ?? []).map((p: any) => ({
          id: String(p.id), thumb: p.src.medium, full: p.src.large2x, author: p.photographer, provider: 'pexels', alt: p.alt ?? clean,
        })),
      };
    } catch (e) { return { results: [], reason: e instanceof Error ? e.message : 'Pexels request failed' }; }
  }
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return { results: [], reason: 'UNSPLASH_ACCESS_KEY is not configured on the server.' };
  try {
    const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(clean)}&per_page=${perPage}&orientation=landscape`, { headers: { Authorization: `Client-ID ${key}` } });
    if (!r.ok) return { results: [], reason: `Unsplash responded ${r.status}` };
    const data = await r.json();
    return {
      results: (data.results ?? []).map((p: any) => ({
        id: p.id, thumb: p.urls?.small, full: p.urls?.regular, author: p.user?.name ?? 'Unsplash', provider: 'unsplash', alt: p.alt_description ?? clean,
      })),
    };
  } catch (e) { return { results: [], reason: e instanceof Error ? e.message : 'Unsplash request failed' }; }
}
