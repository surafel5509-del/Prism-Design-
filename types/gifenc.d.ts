declare module 'gifenc' {
  export interface GifWriter {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: { palette?: number[][]; delay?: number; transparent?: boolean; repeat?: number; first?: boolean }): void;
    finish(): void;
    bytes(): Uint8Array;
    reset(): void;
  }
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GifWriter;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: { format?: 'rgb565' | 'rgb444' | 'rgba4444'; oneBitAlpha?: boolean; clearAlpha?: boolean }): number[][];
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: number[][], format?: 'rgb565' | 'rgb444' | 'rgba4444'): Uint8Array;
  export function precompute(opts: unknown): unknown;
}
