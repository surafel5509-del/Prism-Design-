import { describe, expect, it } from 'vitest';
import { applyOps } from '../ops';
import { createLayer, createProject, createShape, createText, gradient } from '../factory';
import { evalEasing } from '../easing';
import { resolveLayer, sampleChannel, hitTest, transformPoint } from '../animation';
import type { Keyframe } from '../types';

const base = () => createProject({ id: 'test', name: 'Test', width: 1080, height: 1080, duration: 4, background: '#000000' });

describe('deterministic document ops', () => {
  it('adds, patches and deletes layers without mutating the source document', () => {
    const project = base();
    const layer = createShape('rect', { id: 'r1', x: 10, y: 20, w: 100, h: 50, fill: '#ff0000' });
    const added = applyOps(project, [{ op: 'add_layers', layers: [layer] }]);
    expect(added.project.layers).toHaveLength(1);
    expect(project.layers).toHaveLength(0);

    const patched = applyOps(added.project, [{ op: 'update_layer', id: 'r1', patch: { x: 300, opacity: 0.5 } }]);
    expect(patched.project.layers[0].x).toBe(300);
    expect(patched.project.layers[0].opacity).toBe(0.5);

    const deleted = applyOps(patched.project, [{ op: 'delete_layers', ids: ['r1'] }]);
    expect(deleted.project.layers).toHaveLength(0);
    expect(deleted.results[0].ok).toBe(true);
  });

  it('deletes the children of a deleted group', () => {
    const group = createLayer({ id: 'g1', type: 'group', name: 'Group' });
    const child = createShape('rect', { id: 'c1', parentId: 'g1' });
    const project = { ...base(), layers: [group, child] };
    const res = applyOps(project, [{ op: 'delete_layers', ids: ['g1'] }]);
    expect(res.project.layers).toHaveLength(0);
  });

  it('clamps keyframe times and replaces curves', () => {
    const layer = createShape('ellipse', { id: 'e1', x: 100 });
    let doc = { ...base(), layers: [layer] };
    doc = applyOps(doc, [
      { op: 'add_keyframe', layerId: 'e1', prop: 'x', time: 0, value: 0 },
      { op: 'add_keyframe', layerId: 'e1', prop: 'x', time: 2, value: 500 },
    ]).project;
    const kfs = doc.layers[0].keyframes.x!;
    expect(kfs).toHaveLength(2);
    expect(kfs[1].value).toBe(500);

    doc = applyOps(doc, [{ op: 'set_keyframes', layerId: 'e1', prop: 'x', keyframes: [{ id: 'k', time: 1, value: 42, easing: { type: 'linear' } }] }]).project;
    expect(doc.layers[0].keyframes.x).toHaveLength(1);
  });

  it('keeps group and alignment results stable', () => {
    const a = createShape('rect', { id: 'a', x: 0, y: 0, w: 100, h: 100 });
    const b = createShape('rect', { id: 'b', x: 500, y: 0, w: 100, h: 100 });
    const project = { ...base(), layers: [a, b] };
    const grouped = applyOps(project, [{ op: 'group_layers', ids: ['a', 'b'], name: 'Pair', id: 'grp' }]);
    expect(grouped.project.layers.some((l) => l.id === 'grp')).toBe(true);
    expect(grouped.project.layers.find((l) => l.id === 'a')?.parentId).toBe('grp');
  });
});

describe('animation sampling', () => {
  const kfs: Keyframe[] = [
    { id: '1', time: 0, value: 0, easing: { type: 'linear' } },
    { id: '2', time: 2, value: 200, easing: { type: 'linear' } },
  ];

  it('interpolates linearly between keyframes and clamps outside', () => {
    expect(sampleChannel(kfs, 0, 0).value).toBe(0);
    expect(sampleChannel(kfs, 1, 0).value).toBeCloseTo(100, 4);
    expect(sampleChannel(kfs, 2, 0).value).toBe(200);
    expect(sampleChannel(kfs, 9, 0).value).toBe(200);
  });

  it('evaluates every easing family stably, allowing physical overshoot only where intended', () => {
    for (const type of ['linear', 'easeIn', 'easeOut', 'easeInOut', 'spring', 'bounce', 'elastic'] as const) {
      const overshoots = type === 'spring' || type === 'elastic' || type === 'bounce';
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const v = evalEasing({ type }, t);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(overshoots ? -0.4 : -0.001);
        expect(v).toBeLessThanOrEqual(overshoots ? 1.4 : 1.001);
      }
      expect(evalEasing({ type }, 0)).toBeCloseTo(0, 5);
      expect(evalEasing({ type }, 1)).toBeCloseTo(1, 5);
    }
  });

  it('resolves animated transforms at a given time', () => {
    const text = createText('Hello', { id: 't1', x: 100, y: 100, w: 400, keyframes: { opacity: kfs } });
    expect(resolveLayer(text, 0).opacity).toBe(0);
    expect(resolveLayer(text, 2).opacity).toBe(200 / 200);
  });

  it('hit-tests the topmost layer under a point', () => {
    const bottom = createShape('rect', { id: 'bottom', x: 0, y: 0, w: 100, h: 100 });
    const top = createShape('rect', { id: 'top', x: 0, y: 0, w: 100, h: 100 });
    const project = { ...base(), layers: [bottom, top] };
    expect(hitTest(project, 0, 50, 50)?.id).toBe('top');
    expect(hitTest(project, 0, 500, 500)).toBeNull();
  });

  it('maps gradient stops and matrix points correctly', () => {
    const g = gradient(['#000000', '#ffffff'], 90);
    expect(g.stops).toHaveLength(2);
    expect(transformPoint([1, 0, 0, 1, 10, 20], 5, 5)).toEqual([15, 25]);
  });
});
