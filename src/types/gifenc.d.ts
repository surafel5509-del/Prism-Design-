declare module "gifenc" {
  export function GIFEncoder(opts?: { auto?: boolean }): {
    writeFrame: (index: Uint8Array, width: number, height: number, opts?: {
      palette?: number[][];
      first?: boolean;
      repeat?: number;
      delay?: number;
      transparent?: boolean;
    }) => void;
    finish: () => void;
    bytes: () => Uint8Array;
    reset: () => void;
  };
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors?: number, opts?: { format?: string }): number[][];
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: number[][], format?: string): Uint8Array;
}
