import { describe, expect, it } from 'vitest';
import { createToolbelt } from '../tools';
import { applyOps } from '@/lib/engine/ops';
import { createProject } from '@/lib/engine/factory';
import type { Layer, Project } from '@/lib/engine/types';

const project = (): Project => createProject({ id: 'p1', name: 'Agent test', width: 1080, height: 1080, duration: 6, background: '#000000' });

/** Replay the ops the belt streamed back onto a fresh document, exactly like the editor does. */
function replay(doc: Project, ops: NonNullable<Awaited<ReturnType<typeof run>>['result']['ops']>): Project {
  return applyOps(doc, ops).project;
}

async function run(belt: ReturnType<typeof createToolbelt>, name: keyof ReturnType<typeof createToolbelt>['tools'], args: unknown) {
  const tool = belt.tools[name] as unknown as { execute: (a: unknown) => Promise<{ ok: boolean; summary: string; ops?: import('@/lib/engine/ops').Op[]; data?: unknown }> };
  const result = await tool.execute(args);
  return { result, belt };
}

describe('agent toolbelt', () => {
  it('adds text and shapes, and the replayed ops reproduce the server document exactly', async () => {
    const belt = createToolbelt({ project: project(), userId: 'u1' });
    await run(belt, 'add_shape', { shape: 'rect', x: 0.1, y: 0.2, w: 0.5, h: 0.3, fill: '#ff3366' });
    await run(belt, 'add_text', { content: 'Hello Prism', x: 0.1, y: 0.6, fontSize: 84 });
    const layers = belt.getProject().layers;
    expect(layers).toHaveLength(2);
    expect(layers[1].text?.content).toBe('Hello Prism');

    const client = replay(project(), belt.getOps());
    expect(client.layers).toHaveLength(2);
    expect(client.layers.map((l) => [l.name, l.x, l.y, l.w, l.h])).toEqual(layers.map((l) => [l.name, l.x, l.y, l.w, l.h]));
  });

  it('animates a layer with keyframes and applies a preset', async () => {
    const belt = createToolbelt({ project: project(), userId: 'u1' });
    await run(belt, 'add_shape', { shape: 'ellipse', name: 'Orb', x: 0.4, y: 0.4, w: 0.2, h: 0.2 });
    await run(belt, 'add_keyframe', { layer: 'Orb', property: 'x', time: 0, value: 0.2, easing: 'easeOut' });
    await run(belt, 'add_keyframe', { layer: 'Orb', property: 'x', time: 2, value: 0.7, easing: 'easeInOut' });
    await run(belt, 'apply_motion_preset', { layers: ['Orb'], preset: 'scale-pop' });
    const orb = belt.getProject().layers.find((l) => l.name === 'Orb') as Layer;
    expect(orb.keyframes.x).toHaveLength(2);
    expect(orb.keyframes.x![0].value).toBeCloseTo(216, 0);
    expect(orb.keyframes.scaleX?.length).toBeGreaterThan(0);
  });

  it('rejects unknown layer references without mutating the document', async () => {
    const belt = createToolbelt({ project: project(), userId: 'u1' });
    const { result } = await run(belt, 'set_layer', { layer: 'Nope', opacity: 0.4 });
    expect(result.ok).toBe(false);
    expect(belt.getProject().layers).toHaveLength(0);
    expect(belt.getOps()).toHaveLength(0);
  });

  it('builds a design with real layers and replaces the document', async () => {
    const belt = createToolbelt({ project: project(), userId: 'u1' });
    await run(belt, 'generate_design', { brief: 'A loud neon club night poster for Friday', kind: 'poster', aspect: '4:5' });
    const doc = belt.getProject();
    expect(doc.layers.length).toBeGreaterThan(3);
    expect(doc.width).toBe(1080);
    expect(doc.height).toBe(1350);
    expect(doc.layers.some((l) => l.type === 'text')).toBe(true);
    expect(belt.getOps().length).toBeGreaterThan(1);
  });

  it('refuses image generation when no provider is connected (no fake output)', async () => {
    const belt = createToolbelt({ project: project(), userId: 'u1' });
    const { result } = await run(belt, 'generate_image', { prompt: 'a red cube on a white table' });
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/not available/i);
  });

  it('aligns and distributes layers deterministically', async () => {
    const belt = createToolbelt({ project: project(), userId: 'u1' });
    await run(belt, 'add_shape', { shape: 'rect', name: 'A', x: 0.1, y: 0.1, w: 0.2, h: 0.2 });
    await run(belt, 'add_shape', { shape: 'rect', name: 'B', x: 0.6, y: 0.4, w: 0.2, h: 0.2 });
    await run(belt, 'align_layers', { layers: ['A', 'B'], mode: 'hcenter', to: 'canvas' });
    for (const l of belt.getProject().layers) expect(l.x).toBe(432);
  });
});
