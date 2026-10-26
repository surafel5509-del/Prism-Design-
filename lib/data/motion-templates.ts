import type { Aspect, TemplateDef } from '@/lib/engine/types';
import { DIMS, type MotionFamily } from './motion/shared';
import { SET_A } from './motion/set-a';
import { SET_B } from './motion/set-b';

// ─────────────────────────────────────────────────────────────────────────────
//  Long-form motion-graphics library: 14 families × colourways × aspects.
//  Durations run 18–30 s, each sequence is multi-scene, and every layer opens
//  in the timeline as an editable, keyframed object.
// ─────────────────────────────────────────────────────────────────────────────

export const MOTION_FAMILIES: MotionFamily[] = [...SET_A, ...SET_B];

let cache: TemplateDef[] | null = null;

export function getMotionTemplates(): TemplateDef[] {
  if (cache) return cache;
  const out: TemplateDef[] = [];
  MOTION_FAMILIES.forEach((fam, fi) => {
    fam.colorways.forEach((colors, ci) => {
      fam.aspects.forEach((aspect: Aspect) => {
        const [w, h] = DIMS[aspect];
        const font = fam.fonts[ci % fam.fonts.length];
        out.push({
          id: `${fam.id}--${ci}--${aspect.replace(':', 'x')}`,
          name: ci ? `${fam.name} ${ci + 1}` : fam.name,
          category: fam.category,
          tags: [...fam.tags, 'motion graphics', fam.style.toLowerCase(), `${fam.duration}s`, aspect],
          aspect,
          duration: fam.duration,
          palette: colors,
          font,
          pro: fi % 2 === 0,
          render: () => {
            const res = fam.render({ w, h, c: colors, font, dur: fam.duration, aspect });
            const layers = res.layers.map((l) => ({
              ...l,
              startTime: Math.max(0, Math.min(l.startTime, fam.duration - 0.1)),
              endTime: Math.max(0.1, Math.min(l.endTime, fam.duration)),
            }));
            return { layers, width: w, height: h, background: res.background, backgroundGradient: res.backgroundGradient ?? null };
          },
        });
      });
    });
  });
  cache = out;
  return out;
}

export const MOTION_FAMILY_COUNT = MOTION_FAMILIES.length;
export const MOTION_STYLES = MOTION_FAMILIES.map((f) => ({
  id: f.id, name: f.name, style: f.style, duration: f.duration, category: f.category,
  colors: f.colorways[0],
}));
