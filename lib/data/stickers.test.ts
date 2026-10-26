import { describe, expect, it } from 'vitest';
import { getStickers, searchStickers, STICKER_CATEGORIES, STICKER_COUNT } from './stickers';

describe('sticker library', () => {
  it('ships hundreds of transparent SVG stickers', () => {
    expect(STICKER_COUNT()).toBeGreaterThan(200);
    const all = getStickers();
    expect(all.length).toBe(STICKER_COUNT());
    for (const s of all) {
      expect(s.src.startsWith('data:image/svg+xml')).toBe(true);
      expect(s.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('spreads across every category', () => {
    for (const c of STICKER_CATEGORIES) expect(getStickers().some((s) => s.category === c)).toBe(true);
  });

  it('filters by category and searches names/tags', () => {
    expect(searchStickers('', 'Bursts').every((s) => s.category === 'Bursts')).toBe(true);
    expect(searchStickers('arrow').length).toBeGreaterThan(0);
    expect(searchStickers('zzzz-not-a-sticker')).toHaveLength(0);
  });
});
