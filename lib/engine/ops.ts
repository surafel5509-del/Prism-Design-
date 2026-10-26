import type { AnimatableProp, Easing, Effect, Keyframe, Layer, Mask, Project } from './types';
import { resolveLayer } from './animation';
import { deepClone, uid } from '@/lib/utils';

/** Deterministic document operations. The editor store AND the server-side agent
 *  apply exactly these, so an AI run reconstructs the same document on both sides. */
export type Op =
  | { op: 'add_layers'; layers: Layer[]; index?: number }
  | { op: 'update_layer'; id: string; patch: Partial<Layer> }
  | { op: 'delete_layers'; ids: string[] }
  | { op: 'duplicate_layers'; ids: string[] }
  | { op: 'reorder_layer'; id: string; toIndex: number }
  | { op: 'group_layers'; ids: string[]; name?: string; id?: string }
  | { op: 'ungroup_layer'; id: string }
  | { op: 'set_keyframes'; layerId: string; prop: AnimatableProp; keyframes: Keyframe[] }
  | { op: 'add_keyframe'; layerId: string; prop: AnimatableProp; time: number; value: number | string | [number, number]; easing?: Easing }
  | { op: 'remove_keyframe'; layerId: string; prop: AnimatableProp; time: number }
  | { op: 'clear_keyframes'; layerId: string; prop?: AnimatableProp }
  | { op: 'add_effect'; layerId: string; effect: Effect }
  | { op: 'remove_effect'; layerId: string; effectId: string }
  | { op: 'set_mask'; layerId: string; mask: Mask | null }
  | { op: 'set_project'; patch: Partial<Omit<Project, 'layers'>> }
  | { op: 'align'; ids: string[]; mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom' }
  | { op: 'distribute'; ids: string[]; axis: 'horizontal' | 'vertical' }
  | { op: 'set_parent'; id: string; parentId: string | null };

export interface OpResult { op: string; ok: boolean; message: string; ids?: string[] }

export function applyOps(project: Project, ops: Op[], time = 0): { project: Project; results: OpResult[] } {
  let doc = deepClone(project);
  const results: OpResult[] = [];
  for (const op of ops) {
    try {
      const r = applyOp(doc, op, time);
      doc = r.project;
      results.push({ op: op.op, ok: true, message: r.message, ids: r.ids });
    } catch (err) {
      results.push({ op: op.op, ok: false, message: err instanceof Error ? err.message : `Failed: ${op.op}` });
    }
  }
  doc.updatedAt = Date.now();
  return { project: doc, results };
}

function applyOp(doc: Project, op: Op, time: number): { project: Project; message: string; ids?: string[] } {
  switch (op.op) {
    case 'add_layers': {
      const layers = op.layers.map(normalizeLayer).map((l) => ({ ...l, endTime: Math.min(l.endTime || doc.duration, doc.duration) }));
      const idx = op.index == null ? doc.layers.length : Math.max(0, Math.min(doc.layers.length, op.index));
      doc.layers.splice(idx, 0, ...layers);
      return { project: doc, message: `Added ${layers.length} layer${layers.length === 1 ? '' : 's'}`, ids: layers.map((l) => l.id) };
    }
    case 'update_layer': {
      const l = doc.layers.find((x) => x.id === op.id);
      if (!l) throw new Error(`Layer ${op.id} not found`);
      const patch = { ...op.patch };
      if (patch.text) patch.text = { ...l.text, ...patch.text } as Layer['text'];
      if (patch.media) patch.media = { ...l.media, ...patch.media } as Layer['media'];
      if (patch.particles) patch.particles = { ...l.particles, ...patch.particles } as Layer['particles'];
      Object.assign(l, patch);
      return { project: doc, message: `Updated ${l.name}`, ids: [l.id] };
    }
    case 'delete_layers': {
      const ids = new Set(op.ids);
      // also delete descendants of deleted groups
      let changed = true;
      while (changed) {
        changed = false;
        for (const l of doc.layers) {
          if (l.parentId && ids.has(l.parentId) && !ids.has(l.id)) { ids.add(l.id); changed = true; }
        }
      }
      const before = doc.layers.length;
      doc.layers = doc.layers.filter((l) => !ids.has(l.id));
      return { project: doc, message: `Deleted ${before - doc.layers.length} layer(s)` };
    }
    case 'duplicate_layers': {
      const created: string[] = [];
      for (const id of op.ids) {
        const l = doc.layers.find((x) => x.id === id);
        if (!l) continue;
        const copy: Layer = deepClone(l);
        copy.id = uid('ly');
        copy.name = `${l.name} copy`;
        copy.x += 24; copy.y += 24;
        copy.keyframes = shiftKeyframes(copy.keyframes, 0);
        doc.layers.push(copy);
        created.push(copy.id);
      }
      return { project: doc, message: `Duplicated ${created.length} layer(s)`, ids: created };
    }
    case 'reorder_layer': {
      const from = doc.layers.findIndex((l) => l.id === op.id);
      if (from < 0) throw new Error('Layer not found');
      const [l] = doc.layers.splice(from, 1);
      doc.layers.splice(Math.max(0, Math.min(doc.layers.length, op.toIndex)), 0, l);
      return { project: doc, message: `Moved ${l.name}` };
    }
    case 'group_layers': {
      if (op.ids.length === 0) throw new Error('No layers to group');
      const members = doc.layers.filter((l) => op.ids.includes(l.id));
      if (members.length === 0) throw new Error('No matching layers');
      const boxes = members.map((l) => {
        const r = resolveLayer(l, time);
        return { x: r.x, y: r.y, w: r.w, h: r.h };
      });
      const minX = Math.min(...boxes.map((b) => b.x));
      const minY = Math.min(...boxes.map((b) => b.y));
      const maxX = Math.max(...boxes.map((b) => b.x + b.w));
      const maxY = Math.max(...boxes.map((b) => b.y + b.h));
      const group: Layer = normalizeLayer({
        id: op.id ?? uid('grp'), name: op.name ?? 'Group', type: 'group',
        x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY),
        fill: 'transparent', effects: [], keyframes: {}, opacity: 1,
        startTime: Math.min(...members.map((m) => m.startTime)), endTime: Math.max(...members.map((m) => m.endTime)),
      });
      doc.layers.push(group);
      for (const m of members) {
        m.parentId = group.id;
        m.x -= minX; m.y -= minY;
        for (const prop of ['x', 'y'] as AnimatableProp[]) {
          const kfs = m.keyframes[prop];
          if (kfs) kfs.forEach((k) => {
            if (Array.isArray(k.value)) k.value = [k.value[0] - (prop === 'x' ? minX : minY), k.value[1] - (prop === 'x' ? minX : minY)];
            else k.value = Number(k.value) - (prop === 'x' ? minX : minY);
          });
        }
      }
      return { project: doc, message: `Grouped ${members.length} layers`, ids: [group.id] };
    }
    case 'ungroup_layer': {
      const g = doc.layers.find((l) => l.id === op.id && l.type === 'group');
      if (!g) throw new Error('Group not found');
      const kids = doc.layers.filter((l) => l.parentId === g.id);
      for (const k of kids) { k.parentId = null; k.x += g.x; k.y += g.y; }
      doc.layers = doc.layers.filter((l) => l.id !== g.id);
      return { project: doc, message: `Ungrouped ${kids.length} layers`, ids: kids.map((k) => k.id) };
    }
    case 'add_keyframe': {
      const l = doc.layers.find((x) => x.id === op.layerId);
      if (!l) throw new Error('Layer not found');
      const list = (l.keyframes[op.prop] ?? []).slice();
      const existing = list.findIndex((k) => Math.abs(k.time - op.time) < 1e-3);
      const kf: Keyframe = { id: uid('kf'), time: Math.max(0, op.time), value: op.value, easing: op.easing ?? { type: 'easeInOut' } };
      if (existing >= 0) list[existing] = { ...kf, id: list[existing].id };
      else list.push(kf);
      list.sort((a, b) => a.time - b.time);
      l.keyframes[op.prop] = list;
      return { project: doc, message: `Keyframed ${op.prop} at ${op.time.toFixed(2)}s`, ids: [l.id] };
    }
    case 'set_keyframes': {
      const l = doc.layers.find((x) => x.id === op.layerId);
      if (!l) throw new Error('Layer not found');
      l.keyframes[op.prop] = op.keyframes.slice().sort((a, b) => a.time - b.time);
      return { project: doc, message: `Set ${op.keyframes.length} keyframes on ${op.prop}`, ids: [l.id] };
    }
    case 'remove_keyframe': {
      const l = doc.layers.find((x) => x.id === op.layerId);
      if (!l) throw new Error('Layer not found');
      l.keyframes[op.prop] = (l.keyframes[op.prop] ?? []).filter((k) => Math.abs(k.time - op.time) > 1e-3);
      return { project: doc, message: 'Removed keyframe' };
    }
    case 'clear_keyframes': {
      const l = doc.layers.find((x) => x.id === op.layerId);
      if (!l) throw new Error('Layer not found');
      if (op.prop) delete l.keyframes[op.prop];
      else l.keyframes = {};
      return { project: doc, message: 'Cleared keyframes' };
    }
    case 'add_effect': {
      const l = doc.layers.find((x) => x.id === op.layerId);
      if (!l) throw new Error('Layer not found');
      l.effects = [...l.effects.filter((e) => e.type !== op.effect.type), { ...op.effect, id: op.effect.id || uid('fx') }];
      return { project: doc, message: `Added ${op.effect.type} effect`, ids: [l.id] };
    }
    case 'remove_effect': {
      const l = doc.layers.find((x) => x.id === op.layerId);
      if (!l) throw new Error('Layer not found');
      l.effects = l.effects.filter((e) => e.id !== op.effectId);
      return { project: doc, message: 'Removed effect' };
    }
    case 'set_mask': {
      const l = doc.layers.find((x) => x.id === op.layerId);
      if (!l) throw new Error('Layer not found');
      l.mask = op.mask;
      return { project: doc, message: op.mask ? 'Applied mask' : 'Removed mask' };
    }
    case 'set_project': {
      doc = { ...doc, ...op.patch, updatedAt: Date.now() };
      if (op.patch.duration) {
        doc.layers = doc.layers.map((l) => ({ ...l, endTime: Math.min(l.endTime, op.patch.duration!) }));
      }
      return { project: doc, message: 'Updated project' };
    }
    case 'align': {
      const targets = doc.layers.filter((l) => op.ids.includes(l.id));
      if (targets.length === 0) throw new Error('No layers to align');
      const boxes = targets.map((l) => ({ l, r: resolveLayer(l, time) }));
      const minX = Math.min(...boxes.map((b) => b.r.x));
      const maxX = Math.max(...boxes.map((b) => b.r.x + b.r.w));
      const minY = Math.min(...boxes.map((b) => b.r.y));
      const maxY = Math.max(...boxes.map((b) => b.r.y + b.r.h));
      for (const { l, r } of boxes) {
        if (op.mode === 'left') l.x += minX - r.x;
        if (op.mode === 'hcenter') l.x += (minX + maxX) / 2 - (r.x + r.w / 2);
        if (op.mode === 'right') l.x += maxX - (r.x + r.w);
        if (op.mode === 'top') l.y += minY - r.y;
        if (op.mode === 'vcenter') l.y += (minY + maxY) / 2 - (r.y + r.h / 2);
        if (op.mode === 'bottom') l.y += maxY - (r.y + r.h);
      }
      return { project: doc, message: `Aligned ${targets.length} layers ${op.mode}` };
    }
    case 'distribute': {
      const targets = doc.layers.filter((l) => op.ids.includes(l.id));
      if (targets.length < 3) throw new Error('Distribute needs 3+ layers');
      const axis = op.axis;
      const items = targets.map((l) => ({ l, r: resolveLayer(l, time) }))
        .sort((a, b) => (axis === 'horizontal' ? a.r.x - b.r.x : a.r.y - b.r.y));
      const first = items[0].r, last = items[items.length - 1].r;
      const spanStart = axis === 'horizontal' ? first.x : first.y;
      const spanEnd = axis === 'horizontal' ? last.x + last.w : last.y + last.h;
      const totalSize = items.reduce((a, it) => a + (axis === 'horizontal' ? it.r.w : it.r.h), 0);
      const gap = (spanEnd - spanStart - totalSize) / (items.length - 1);
      let cursor = spanStart;
      for (const it of items) {
        if (axis === 'horizontal') it.l.x += cursor - it.r.x;
        else it.l.y += cursor - it.r.y;
        cursor += (axis === 'horizontal' ? it.r.w : it.r.h) + gap;
      }
      return { project: doc, message: `Distributed ${targets.length} layers ${axis}` };
    }
    case 'set_parent': {
      const l = doc.layers.find((x) => x.id === op.id);
      if (!l) throw new Error('Layer not found');
      l.parentId = op.parentId;
      return { project: doc, message: 'Parented layer' };
    }
    default:
      throw new Error(`Unknown op ${(op as { op: string }).op}`);
  }
}

export function normalizeLayer(partial: Partial<Layer> & { type?: Layer['type'] }): Layer {
  const now = Date.now();
  return {
    id: partial.id ?? uid('ly'),
    name: partial.name ?? (partial.type === 'text' ? 'Text' : 'Layer'),
    type: partial.type ?? 'shape',
    x: partial.x ?? 0, y: partial.y ?? 0, w: partial.w ?? 200, h: partial.h ?? 200,
    rotation: partial.rotation ?? 0, scaleX: partial.scaleX ?? 1, scaleY: partial.scaleY ?? 1,
    skewX: partial.skewX ?? 0, skewY: partial.skewY ?? 0,
    anchorX: partial.anchorX ?? 0, anchorY: partial.anchorY ?? 0,
    opacity: partial.opacity ?? 1,
    blendMode: partial.blendMode ?? 'normal',
    visible: partial.visible ?? true, locked: partial.locked ?? false,
    fill: partial.fill ?? '#8b5cf6', fillGradient: partial.fillGradient ?? null,
    stroke: partial.stroke, strokeWidth: partial.strokeWidth ?? 0, radius: partial.radius ?? 0,
    shape: partial.shape ?? 'rect', points: partial.points ?? 5, innerRadius: partial.innerRadius ?? 0.45,
    text: partial.text, media: partial.media, path: partial.path,
    effects: partial.effects ?? [], keyframes: partial.keyframes ?? {},
    parentId: partial.parentId ?? null,
    startTime: partial.startTime ?? 0, endTime: partial.endTime ?? 8,
    mask: partial.mask ?? null, motionPath: partial.motionPath ?? null,
    particles: partial.particles ?? null, meta: { ...(partial.meta ?? {}), createdAt: now },
  };
}

function shiftKeyframes(kf: Record<string, Keyframe[] | undefined>, dt: number) {
  const out: Record<string, Keyframe[]> = {};
  for (const [key, list] of Object.entries(kf)) {
    if (!list) continue;
    out[key] = list.map((k) => ({ ...k, id: uid('kf'), time: k.time + dt }));
  }
  return out as Layer['keyframes'];
}

export function newEffect(type: Effect['type'], amount = 30, extras: Partial<Effect> = {}): Effect {
  return { id: uid('fx'), type, enabled: true, amount, ...extras };
}
