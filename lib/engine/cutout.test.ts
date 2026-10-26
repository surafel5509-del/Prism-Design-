import { beforeAll, describe, expect, it } from 'vitest';
import { featherMask, floodSelect, keyColourMask } from './cutout';

// Node has no ImageData; this mirrors the browser API surface our mask code uses.
class FakeImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(a: number | Uint8ClampedArray, b?: number, c?: number) {
    if (typeof a === 'number') {
      this.width = a;
      this.height = b ?? 1;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = a;
      this.width = b ?? 1;
      this.height = c ?? a.length / 4;
    }
  }
}

beforeAll(() => {
  (globalThis as unknown as { ImageData: typeof FakeImageData }).ImageData = FakeImageData;
});

function img(pixels: [number, number, number, number][]) {
  const out = new FakeImageData(pixels.length, 1);
  pixels.forEach((p, i) => { out.data.set(p, i * 4); });
  return out as unknown as ImageData;
}

describe('manual cut-out maths', () => {
  it('keys an exact colour and leaves near neighbours alone', () => {
    const src = img([[255, 0, 0, 255], [0, 0, 255, 255], [250, 4, 4, 255]]);
    const mask = keyColourMask(src, '#ff0000', 10);
    expect(mask.data[3]).toBe(255);
    expect(mask.data[7]).toBe(0);
    expect(mask.data[11]).toBeGreaterThan(60);
    expect(mask.data[11]).toBeLessThan(255);
  });

  it('flood-selects only the contiguous region', () => {
    const src = img([[255, 0, 0, 255], [255, 0, 0, 255], [0, 0, 255, 255], [255, 0, 0, 255]]);
    const sel = floodSelect(src, 0, 0, 12);
    expect(sel.data[3]).toBe(255);
    expect(sel.data[7]).toBe(255);
    expect(sel.data[11]).toBe(0);
    expect(sel.data[15]).toBe(0);
  });

  it('feathers the mask edge into partial alpha', () => {
    const src = img([[255, 255, 255, 255], [255, 255, 255, 255], [255, 255, 255, 0], [255, 255, 255, 0]]);
    const soft = featherMask(src, 1);
    expect(soft.data[11]).toBeGreaterThan(0);
    expect(soft.data[11]).toBeLessThan(255);
  });
});
