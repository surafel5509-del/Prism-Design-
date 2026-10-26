import { describe, expect, it } from 'vitest';
import { getTemplates } from './templates';
import { getMotionTemplates, MOTION_FAMILY_COUNT } from './motion-templates';
import { getDesignTemplates } from './design-templates';

describe('template library', () => {
  const all = getTemplates();
  const motion = getMotionTemplates();

  it('ships hundreds of templates across design and motion', () => {
    expect(all.length).toBeGreaterThan(700);
  });

  it('ships long-form motion families between 15 and 30 seconds', () => {
    expect(MOTION_FAMILY_COUNT).toBeGreaterThanOrEqual(12);
    expect(motion.length).toBeGreaterThan(40);
    for (const t of motion) {
      expect(t.duration).toBeGreaterThanOrEqual(15);
      expect(t.duration).toBeLessThanOrEqual(30);
      expect(t.tags).toContain('motion graphics');
    }
  });

  it('every template renders real layers inside the timeline', () => {
    for (const list of [all, motion, getDesignTemplates()]) {
      for (const template of list) {
        const rendered = template.render();
        expect(rendered.layers.length).toBeGreaterThan(0);
        expect(rendered.width).toBeGreaterThan(0);
        for (const layer of rendered.layers) {
          expect(layer.id).toBeTruthy();
          expect(layer.endTime).toBeGreaterThanOrEqual(layer.startTime);
          expect(layer.endTime).toBeLessThanOrEqual(template.duration + 0.001);
        }
      }
    }
  });

  it('uses all four aspect ratios somewhere', () => {
    const aspects = new Set(all.map((t) => t.aspect));
    expect(aspects.has('16:9')).toBe(true);
    expect(aspects.has('9:16')).toBe(true);
    expect(aspects.has('1:1')).toBe(true);
    expect(aspects.has('4:5')).toBe(true);
  });
});
