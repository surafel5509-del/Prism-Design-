'use client';
import { create } from 'zustand';
import type { AnimatableProp, BrandKit, Effect, Layer, Project, ShapeKind, TemplateDef } from '@/lib/engine/types';
import { createLayer, createProject, DEFAULT_BRAND_KIT, PALETTES } from '@/lib/engine/factory';
import { applyOps, newEffect, type Op } from '@/lib/engine/ops';
import { getPropertyValue } from '@/lib/engine/animation';
import { clamp, deepClone, uid } from '@/lib/utils';
import { idbPut } from './idb';

export type Tool = 'select' | 'move' | 'hand' | 'shape' | 'pen' | 'text' | 'image' | 'video' | 'audio' | 'zoom';
export type LeftTab = 'layers' | 'assets' | 'templates' | 'brand' | 'effects';
export type RightTab = 'properties' | 'effects' | 'animate' | 'ai';

export interface Asset {
  id: string; name: string; type: 'image' | 'video' | 'svg' | 'lottie' | 'audio';
  src: string; w?: number; h?: number; createdAt: number; size?: number;
}

export interface Toast { id: string; title: string; description?: string; kind: 'info' | 'success' | 'error' }

interface EditorStore {
  project: Project;
  selection: string[];
  hover: string | null;
  tool: Tool;
  shapeKind: ShapeKind;
  time: number;
  playing: boolean;
  loopMode: 'none' | 'loop' | 'pingpong';
  speed: number;
  view: { zoom: number; panX: number; panY: number };
  viewport: { w: number; h: number };
  showRulers: boolean;
  showGrid: boolean;
  showGuides: boolean;
  showSafe: boolean;
  snap: boolean;
  leftTab: LeftTab;
  rightTab: RightTab;
  leftOpen: boolean;
  aiOpen: boolean;
  timelineOpen: boolean;
  timelineHeight: number;
  timelineZoom: number;
  past: Project[];
  future: Project[];
  savedAt: number | null;
  dirty: boolean;
  hydrated: boolean;
  clipboard: Layer[];
  brandKits: BrandKit[];
  activeBrandKitId: string;
  assets: Asset[];
  favorites: string[];
  previewOpen: boolean;
  exportOpen: boolean;
  shareOpen: boolean;
  paletteOpen: boolean;
  onboardingStep: number | null;
  agentPreview: string | null;

  // project
  newProject: (overrides?: Partial<Project>) => void;
  loadProject: (p: Project, opts?: { keepHistory?: boolean }) => void;
  patchProject: (patch: Partial<Project>, opts?: { history?: boolean }) => void;
  setDuration: (d: number) => void;
  setBackground: (value: string | null, gradient?: Project['backgroundGradient']) => void;
  markSaved: () => void;
  setHydrated: (v: boolean) => void;

  // layers
  addLayer: (layer: Layer, opts?: { select?: boolean; index?: number; history?: boolean }) => Layer;
  addLayers: (layers: Layer[], opts?: { select?: boolean }) => void;
  updateLayer: (id: string, patch: Partial<Layer>, opts?: { history?: boolean; keyframe?: 'auto' | 'never' }) => void;
  updateSelected: (patch: Partial<Layer>) => void;
  deleteLayers: (ids?: string[]) => void;
  duplicateLayers: (ids?: string[]) => void;
  reorderLayer: (id: string, toIndex: number) => void;
  moveLayerBy: (id: string, delta: number) => void;
  groupSelected: () => void;
  ungroup: (id?: string) => void;
  alignSelected: (mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => void;
  distributeSelected: (axis: 'horizontal' | 'vertical') => void;
  setParent: (id: string, parentId: string | null) => void;
  copySelection: () => void;
  paste: () => void;
  select: (ids: string[]) => void;
  toggleSelect: (id: string, additive?: boolean) => void;
  selectAll: () => void;
  setHover: (id: string | null) => void;

  // history
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // tool + view
  setTool: (t: Tool) => void;
  setShapeKind: (k: ShapeKind) => void;
  setView: (v: Partial<{ zoom: number; panX: number; panY: number }>) => void;
  zoomAt: (factor: number, cx: number, cy: number) => void;
  fitView: () => void;
  setViewport: (w: number, h: number) => void;
  toggle: (key: 'showRulers' | 'showGrid' | 'showGuides' | 'showSafe' | 'snap' | 'aiOpen' | 'timelineOpen' | 'leftOpen') => void;
  setLeftTab: (t: LeftTab) => void;
  setRightTab: (t: RightTab) => void;
  setTimelineHeight: (h: number) => void;
  setTimelineZoom: (z: number) => void;
  setPreviewOpen: (v: boolean) => void;
  setExportOpen: (v: boolean) => void;
  setShareOpen: (v: boolean) => void;
  setPaletteOpen: (v: boolean) => void;
  setOnboardingStep: (v: number | null) => void;
  setAgentPreview: (v: string | null) => void;

  // playback
  setTime: (t: number) => void;
  setPlaying: (v: boolean) => void;
  togglePlay: () => void;
  stepFrames: (n: number) => void;
  setLoopMode: (m: 'none' | 'loop' | 'pingpong') => void;
  setSpeed: (s: number) => void;

  // keyframes
  keyframeProp: (layerId: string, prop: AnimatableProp, value?: number | string | [number, number], time?: number) => void;
  removeKeyframeAt: (layerId: string, prop: AnimatableProp, time: number) => void;
  toggleKeyframe: (layerId: string, prop: AnimatableProp) => void;
  setLayerEasing: (layerId: string, prop: AnimatableProp, easingId: string) => void;
  clearPropertyKeyframes: (layerId: string, prop: AnimatableProp) => void;

  // effects
  addEffect: (layerId: string, type: Effect['type'], amount?: number) => void;
  updateEffect: (layerId: string, effectId: string, patch: Partial<Effect>) => void;
  removeEffect: (layerId: string, effectId: string) => void;

  // brand/assets/templates
  saveBrandKit: (kit: BrandKit) => void;
  deleteBrandKit: (id: string) => void;
  applyBrandKit: (id: string) => void;
  addAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;
  insertAsset: (assetId: string) => void;
  applyTemplate: (template: TemplateDef, mode?: 'replace' | 'append') => void;
  toggleFavorite: (id: string) => void;

  // agent
  applyAgentOps: (ops: Op[], meta?: { label?: string; snapshot?: Project }) => void;
  replaceProjectFromAgent: (p: Project) => void;

  hydrate: () => Promise<void>;
}

const HISTORY_LIMIT = 50;
const LAST_PROJECT_KEY = 'prism:lastProjectId';
const BRAND_KEY = 'prism:brandKits';
const FAV_KEY = 'prism:favorites';

function snapshot(p: Project): Project { return deepClone(p); }

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function writeLocal(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

export const useEditor = create<EditorStore>((set, get) => ({
  project: createProject({ name: 'Untitled project' }),
  selection: [],
  hover: null,
  tool: 'select',
  shapeKind: 'rect',
  time: 0,
  playing: false,
  loopMode: 'loop',
  speed: 1,
  view: { zoom: 0.5, panX: 80, panY: 80 },
  viewport: { w: 1200, h: 700 },
  showRulers: true,
  showGrid: false,
  showGuides: true,
  showSafe: false,
  snap: true,
  leftTab: 'layers',
  rightTab: 'properties',
  leftOpen: true,
  aiOpen: false,
  timelineOpen: true,
  timelineHeight: 232,
  timelineZoom: 1,
  past: [],
  future: [],
  savedAt: null,
  dirty: false,
  hydrated: false,
  clipboard: [],
  brandKits: [],
  activeBrandKitId: 'bk_default',
  assets: [],
  favorites: [],
  previewOpen: false,
  exportOpen: false,
  shareOpen: false,
  paletteOpen: false,
  onboardingStep: null,
  agentPreview: null,

  newProject: (overrides = {}) => {
    const p = createProject(overrides);
    set({
      project: p, selection: [], time: 0, playing: false, past: [], future: [],
      view: { zoom: 0.5, panX: 80, panY: 80 }, dirty: true,
      rightTab: 'properties', leftTab: 'layers',
    });
  },

  loadProject: (p, opts) => {
    const project = { ...createProject(), ...deepClone(p), updatedAt: Date.now() };
    set({
      project, selection: [], time: 0, playing: false,
      past: opts?.keepHistory ? get().past : [], future: opts?.keepHistory ? get().future : [],
      dirty: false,
    });
  },

  patchProject: (patch, opts) => {
    if (opts?.history !== false) get().pushHistory();
    set((s) => ({ project: { ...s.project, ...patch, updatedAt: Date.now() }, dirty: true }));
  },

  setDuration: (d) => {
    const duration = clamp(d, 0.5, 600);
    get().pushHistory();
    set((s) => ({
      project: {
        ...s.project, duration, updatedAt: Date.now(),
        layers: s.project.layers.map((l) => ({ ...l, endTime: Math.min(l.endTime, duration) })),
      },
      time: Math.min(s.time, duration), dirty: true,
    }));
  },

  setBackground: (value, gradient) => {
    get().pushHistory();
    set((s) => ({
      project: { ...s.project, background: value ?? s.project.background, backgroundGradient: gradient === undefined ? s.project.backgroundGradient : gradient, updatedAt: Date.now() },
      dirty: true,
    }));
  },

  markSaved: () => set({ savedAt: Date.now(), dirty: false }),
  setHydrated: (v) => set({ hydrated: v }),

  addLayer: (layer, opts) => {
    if (opts?.history !== false) get().pushHistory();
    const l = { ...layer, endTime: Math.min(layer.endTime || get().project.duration, get().project.duration) };
    set((s) => {
      const layers = [...s.project.layers];
      const index = opts?.index ?? layers.length;
      layers.splice(index, 0, l);
      return {
        project: { ...s.project, layers, updatedAt: Date.now() },
        selection: opts?.select === false ? s.selection : [l.id],
        dirty: true,
      };
    });
    return l;
  },

  addLayers: (layers, opts) => {
    get().pushHistory();
    set((s) => ({
      project: { ...s.project, layers: [...s.project.layers, ...layers], updatedAt: Date.now() },
      selection: opts?.select === false ? s.selection : layers.map((l) => l.id),
      dirty: true,
    }));
  },

  updateLayer: (id, patch, opts) => {
    if (opts?.history !== false) get().pushHistory();
    set((s) => {
      const layers = s.project.layers.map((l) => {
        if (l.id !== id) return l;
        let next: Layer = { ...l, ...patch };
        if (patch.text) next.text = { ...l.text, ...patch.text } as Layer['text'];
        if (patch.media) next.media = { ...l.media, ...patch.media } as Layer['media'];
        // Auto-keyframe: if a channel already has keys, write a keyframe at the playhead.
        if (opts?.keyframe !== 'never') {
          const propMap: Record<string, AnimatableProp> = { x: 'x', y: 'y', w: 'w', h: 'h', rotation: 'rotation', scaleX: 'scaleX', scaleY: 'scaleY', opacity: 'opacity' };
          for (const [key, prop] of Object.entries(propMap)) {
            const value = (patch as Record<string, unknown>)[key];
            const existing = next.keyframes[prop];
            if (value === undefined || typeof value !== 'number' || !existing || existing.length === 0) continue;
            if (key !== 'opacity' && key !== 'rotation' && key !== 'scaleX' && key !== 'scaleY' && key !== 'x' && key !== 'y' && key !== 'w' && key !== 'h') continue;
            const t = s.time;
            const list = existing.slice();
            const idx = list.findIndex((k) => Math.abs(k.time - t) < 0.02);
            const kf = { id: idx >= 0 ? list[idx].id : uid('kf'), time: t, value, easing: { type: 'easeInOut' as const } };
            if (idx >= 0) list[idx] = kf; else list.push(kf);
            list.sort((a, b) => a.time - b.time);
            next = { ...next, keyframes: { ...next.keyframes, [prop]: list } };
          }
        }
        return next;
      });
      return { project: { ...s.project, layers, updatedAt: Date.now() }, dirty: true };
    });
  },

  updateSelected: (patch) => {
    const ids = get().selection;
    if (!ids.length) return;
    get().pushHistory();
    for (const id of ids) get().updateLayer(id, patch, { history: false });
  },

  deleteLayers: (ids) => {
    const targets = ids ?? get().selection;
    if (!targets.length) return;
    get().pushHistory();
    set((s) => {
      const set_ = new Set(targets);
      let changed = true;
      while (changed) {
        changed = false;
        for (const l of s.project.layers) if (l.parentId && set_.has(l.parentId) && !set_.has(l.id)) { set_.add(l.id); changed = true; }
      }
      return {
        project: { ...s.project, layers: s.project.layers.filter((l) => !set_.has(l.id)), updatedAt: Date.now() },
        selection: [], dirty: true,
      };
    });
  },

  duplicateLayers: (ids) => {
    const targets = ids ?? get().selection;
    if (!targets.length) return;
    get().pushHistory();
    set((s) => {
      const copies: Layer[] = [];
      for (const id of targets) {
        const l = s.project.layers.find((x) => x.id === id);
        if (!l) continue;
        const copy: Layer = deepClone(l);
        copy.id = uid('ly');
        copy.name = `${l.name} copy`;
        copy.x += 24; copy.y += 24;
        copy.parentId = l.parentId;
        copies.push(copy);
      }
      return {
        project: { ...s.project, layers: [...s.project.layers, ...copies], updatedAt: Date.now() },
        selection: copies.map((c) => c.id), dirty: true,
      };
    });
  },

  reorderLayer: (id, toIndex) => {
    get().pushHistory();
    set((s) => {
      const layers = [...s.project.layers];
      const from = layers.findIndex((l) => l.id === id);
      if (from < 0) return {};
      const [l] = layers.splice(from, 1);
      layers.splice(clamp(toIndex, 0, layers.length), 0, l);
      return { project: { ...s.project, layers, updatedAt: Date.now() }, dirty: true };
    });
  },

  moveLayerBy: (id, delta) => {
    const idx = get().project.layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    get().reorderLayer(id, idx + delta);
  },

  groupSelected: () => {
    const ids = get().selection;
    if (!ids.length) return;
    get().pushHistory();
    const { project } = applyOps(get().project, [{ op: 'group_layers', ids }], get().time);
    const groupId = project.layers.filter((l) => l.type === 'group').slice(-1)[0]?.id;
    set({ project, selection: groupId ? [groupId] : ids, dirty: true });
  },

  ungroup: (id) => {
    const target = id ?? get().selection[0];
    if (!target) return;
    get().pushHistory();
    const { project } = applyOps(get().project, [{ op: 'ungroup_layer', id: target }], get().time);
    set({ project, selection: [], dirty: true });
  },

  alignSelected: (mode) => {
    const ids = get().selection;
    if (!ids.length) return;
    get().pushHistory();
    const { project } = applyOps(get().project, [{ op: 'align', ids, mode }], get().time);
    set({ project, dirty: true });
  },

  distributeSelected: (axis) => {
    const ids = get().selection;
    if (ids.length < 3) return;
    get().pushHistory();
    const { project } = applyOps(get().project, [{ op: 'distribute', ids, axis }], get().time);
    set({ project, dirty: true });
  },

  setParent: (id, parentId) => {
    get().pushHistory();
    set((s) => ({
      project: { ...s.project, layers: s.project.layers.map((l) => (l.id === id ? { ...l, parentId } : l)), updatedAt: Date.now() },
      dirty: true,
    }));
  },

  copySelection: () => {
    const s = get();
    const layers = s.project.layers.filter((l) => s.selection.includes(l.id));
    set({ clipboard: deepClone(layers) });
  },

  paste: () => {
    const clip = get().clipboard;
    if (!clip.length) return;
    get().pushHistory();
    const copies = clip.map((l) => ({ ...deepClone(l), id: uid('ly'), x: l.x + 32, y: l.y + 32, name: `${l.name}` }));
    set((s) => ({
      project: { ...s.project, layers: [...s.project.layers, ...copies], updatedAt: Date.now() },
      selection: copies.map((c) => c.id), dirty: true,
    }));
  },

  select: (ids) => set({ selection: ids }),
  toggleSelect: (id, additive) => set((s) => {
    if (!additive) return { selection: [id] };
    return { selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id] };
  }),
  selectAll: () => set((s) => ({ selection: s.project.layers.filter((l) => !l.locked && l.visible).map((l) => l.id) })),
  setHover: (id) => set({ hover: id }),

  pushHistory: () => set((s) => ({
    past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot(s.project)],
    future: [],
  })),

  undo: () => set((s) => {
    if (!s.past.length) return {};
    const prev = s.past[s.past.length - 1];
    return {
      project: prev, past: s.past.slice(0, -1), future: [snapshot(s.project), ...s.future].slice(0, HISTORY_LIMIT),
      selection: s.selection.filter((id) => prev.layers.some((l) => l.id === id)), time: Math.min(s.time, prev.duration), dirty: true,
    };
  }),

  redo: () => set((s) => {
    if (!s.future.length) return {};
    const next = s.future[0];
    return {
      project: next, past: [...s.past, snapshot(s.project)].slice(-HISTORY_LIMIT), future: s.future.slice(1),
      selection: s.selection.filter((id) => next.layers.some((l) => l.id === id)), dirty: true,
    };
  }),

  setTool: (t) => set({ tool: t }),
  setShapeKind: (k) => set({ shapeKind: k }),
  setView: (v) => set((s) => ({ view: { ...s.view, ...v } })),
  zoomAt: (factor, cx, cy) => set((s) => {
    const zoom = clamp(s.view.zoom * factor, 0.04, 12);
    const k = zoom / s.view.zoom;
    return { view: { zoom, panX: cx - (cx - s.view.panX) * k, panY: cy - (cy - s.view.panY) * k } };
  }),
  fitView: () => set((s) => {
    const pad = 96;
    const zoom = clamp(Math.min((s.viewport.w - pad) / s.project.width, (s.viewport.h - pad) / s.project.height), 0.04, 4);
    return { view: { zoom, panX: (s.viewport.w - s.project.width * zoom) / 2, panY: (s.viewport.h - s.project.height * zoom) / 2 } };
  }),
  setViewport: (w, h) => set({ viewport: { w, h } }),
  toggle: (key) => set((s) => ({ [key]: !s[key] } as Pick<EditorStore, typeof key>)),
  setLeftTab: (t) => set({ leftTab: t, leftOpen: true }),
  setRightTab: (t) => set({ rightTab: t }),
  setTimelineHeight: (h) => set({ timelineHeight: clamp(h, 120, 560) }),
  setTimelineZoom: (z) => set({ timelineZoom: clamp(z, 0.4, 8) }),
  setPreviewOpen: (v) => set({ previewOpen: v }),
  setExportOpen: (v) => set({ exportOpen: v }),
  setShareOpen: (v) => set({ shareOpen: v }),
  setPaletteOpen: (v) => set({ paletteOpen: v }),
  setOnboardingStep: (v) => set({ onboardingStep: v }),
  setAgentPreview: (v) => set({ agentPreview: v }),

  setTime: (t) => set((s) => ({ time: clamp(t, 0, s.project.duration) })),
  setPlaying: (v) => set({ playing: v }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  stepFrames: (n) => set((s) => ({ time: clamp(s.time + n / s.project.fps, 0, s.project.duration), playing: false })),
  setLoopMode: (m) => set({ loopMode: m }),
  setSpeed: (s2) => set({ speed: clamp(s2, 0.1, 4) }),

  keyframeProp: (layerId, prop, value, time) => {
    const s = get();
    const layer = s.project.layers.find((l) => l.id === layerId);
    if (!layer) return;
    const t = time ?? s.time;
    const v = value ?? getPropertyValue(layer, prop);
    s.pushHistory();
    const list = (layer.keyframes[prop] ?? []).slice();
    const idx = list.findIndex((k) => Math.abs(k.time - t) < 0.02);
    const kf = { id: idx >= 0 ? list[idx].id : uid('kf'), time: t, value: v, easing: idx >= 0 ? list[idx].easing : { type: 'easeInOut' as const } };
    if (idx >= 0) list[idx] = kf; else list.push(kf);
    list.sort((a, b) => a.time - b.time);
    set((st) => ({
      project: { ...st.project, layers: st.project.layers.map((l) => (l.id === layerId ? { ...l, keyframes: { ...l.keyframes, [prop]: list } } : l)), updatedAt: Date.now() },
      dirty: true,
    }));
  },

  removeKeyframeAt: (layerId, prop, time) => {
    get().pushHistory();
    set((s) => ({
      project: { ...s.project, layers: s.project.layers.map((l) => (l.id === layerId ? { ...l, keyframes: { ...l.keyframes, [prop]: (l.keyframes[prop] ?? []).filter((k) => Math.abs(k.time - time) > 0.02) } } : l)), updatedAt: Date.now() },
      dirty: true,
    }));
  },

  toggleKeyframe: (layerId, prop) => {
    const s = get();
    const layer = s.project.layers.find((l) => l.id === layerId);
    if (!layer) return;
    const existing = (layer.keyframes[prop] ?? []).find((k) => Math.abs(k.time - s.time) < 0.03);
    if (existing) s.removeKeyframeAt(layerId, prop, existing.time);
    else s.keyframeProp(layerId, prop);
  },

  setLayerEasing: (layerId, prop, easingId) => {
    get().pushHistory();
    set((s) => ({
      project: {
        ...s.project,
        layers: s.project.layers.map((l) => {
          if (l.id !== layerId) return l;
          const list = (l.keyframes[prop] ?? []).map((k) => ({ ...k, easing: { type: easingId as 'linear' } }));
          return { ...l, keyframes: { ...l.keyframes, [prop]: list } };
        }),
        updatedAt: Date.now(),
      },
      dirty: true,
    }));
  },

  clearPropertyKeyframes: (layerId, prop) => {
    get().pushHistory();
    set((s) => ({
      project: { ...s.project, layers: s.project.layers.map((l) => {
        if (l.id !== layerId) return l;
        const keyframes = { ...l.keyframes };
        delete keyframes[prop];
        return { ...l, keyframes };
      }), updatedAt: Date.now() },
      dirty: true,
    }));
  },

  addEffect: (layerId, type, amount = 30) => {
    get().pushHistory();
    set((s) => ({
      project: { ...s.project, layers: s.project.layers.map((l) => (l.id === layerId ? { ...l, effects: [...l.effects.filter((e) => e.type !== type), newEffect(type, amount)] } : l)), updatedAt: Date.now() },
      dirty: true,
    }));
  },

  updateEffect: (layerId, effectId, patch) => set((s) => ({
    project: { ...s.project, layers: s.project.layers.map((l) => (l.id === layerId ? { ...l, effects: l.effects.map((e) => (e.id === effectId ? { ...e, ...patch } : e)) } : l)), updatedAt: Date.now() },
    dirty: true,
  })),

  removeEffect: (layerId, effectId) => {
    get().pushHistory();
    set((s) => ({
      project: { ...s.project, layers: s.project.layers.map((l) => (l.id === layerId ? { ...l, effects: l.effects.filter((e) => e.id !== effectId) } : l)), updatedAt: Date.now() },
      dirty: true,
    }));
  },

  saveBrandKit: (kit) => {
    const kits = get().brandKits.some((k) => k.id === kit.id)
      ? get().brandKits.map((k) => (k.id === kit.id ? kit : k))
      : [...get().brandKits, kit];
    set({ brandKits: kits });
    writeLocal(BRAND_KEY, kits);
  },
  deleteBrandKit: (id) => {
    const kits = get().brandKits.filter((k) => k.id !== id);
    set({ brandKits: kits, activeBrandKitId: get().activeBrandKitId === id ? 'bk_default' : get().activeBrandKitId });
    writeLocal(BRAND_KEY, kits);
  },
  applyBrandKit: (id) => {
    const kit = get().brandKits.find((k) => k.id === id) ?? DEFAULT_BRAND_KIT;
    get().pushHistory();
    set((s) => ({
      project: {
        ...s.project,
        brandKitId: id,
        layers: s.project.layers.map((l) => {
          if (l.type !== 'text' || !l.text) return l;
          return { ...l, text: { ...l.text, fontFamily: l.text.fontFamily === 'Playfair Display' || l.text.fontFamily === 'JetBrains Mono' ? l.text.fontFamily : kit.fonts.heading } };
        }),
        updatedAt: Date.now(),
      },
      activeBrandKitId: id, dirty: true,
    }));
  },

  addAsset: (asset) => set((s) => ({ assets: [asset, ...s.assets.filter((a) => a.id !== asset.id)] })),
  removeAsset: (id) => set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),
  insertAsset: (assetId) => {
    const asset = get().assets.find((a) => a.id === assetId);
    if (!asset) return;
    const p = get().project;
    const w = Math.min(asset.w ?? p.width * 0.5, p.width * 0.8);
    const h = asset.h ? (w / asset.w!) * asset.h : w * 0.66;
    const layer = createLayer({
      type: 'image', name: asset.name, x: (p.width - w) / 2, y: (p.height - h) / 2, w, h,
      fill: 'transparent', media: { src: asset.src, fit: 'cover' }, endTime: p.duration,
    });
    get().addLayer(layer);
  },

  applyTemplate: (template, mode = 'replace') => {
    const rendered = template.render();
    get().pushHistory();
    set((s) => ({
      project: {
        ...s.project,
        width: rendered.width, height: rendered.height,
        background: rendered.background,
        backgroundGradient: rendered.backgroundGradient ?? null,
        duration: template.duration, fps: 30,
        layers: mode === 'replace' ? rendered.layers : [...s.project.layers, ...rendered.layers],
        name: mode === 'replace' ? `${template.name} — ${template.palette[0]}` : s.project.name,
        updatedAt: Date.now(),
      },
      selection: [], time: 0, dirty: true,
      view: { zoom: Math.min(0.8, 900 / rendered.width), panX: 80, panY: 80 },
    }));
  },

  toggleFavorite: (id) => {
    const favorites = get().favorites.includes(id) ? get().favorites.filter((x) => x !== id) : [...get().favorites, id];
    set({ favorites });
    writeLocal(FAV_KEY, favorites);
  },

  applyAgentOps: (ops, meta) => {
    const before = meta?.snapshot ?? get().project;
    get().pushHistory();
    const { project, results } = applyOps(before, ops, get().time);
    const newIds = results.flatMap((r) => r.ids ?? []);
    set({ project, dirty: true, selection: newIds.length ? newIds : get().selection });
    writeLocal('prism:lastAgentOps', { at: Date.now(), results });
  },

  replaceProjectFromAgent: (p) => {
    get().pushHistory();
    set({ project: { ...p, updatedAt: Date.now() }, dirty: true, selection: [] });
  },

  hydrate: async () => {
    const kits = readLocal<BrandKit[]>(BRAND_KEY, []);
    const favorites = readLocal<string[]>(FAV_KEY, []);
    const brandKits = kits.length ? kits : [DEFAULT_BRAND_KIT];
    set({ brandKits, favorites });
    try {
      const lastId = localStorage.getItem(LAST_PROJECT_KEY);
      if (lastId) {
        const saved = await idbGetProject(lastId);
        if (saved) {
          const project = { ...createProject(), ...saved, layers: saved.layers ?? [] } as Project;
          const zoom = Math.min(0.8, 900 / project.width);
          set({ project, view: { zoom, panX: 80, panY: 80 }, hydrated: true, dirty: false });
          return;
        }
      }
    } catch { /* noop */ }
    set({ hydrated: true });
  },
}));

async function idbGetProject(id: string) {
  const { idbGet } = await import('./idb');
  return idbGet<Project>('projects', id);
}

export async function persistProject(project: Project, opts: { versionLabel?: string; forceVersion?: boolean } = {}) {
  await idbPut('projects', { ...project, updatedAt: Date.now() });
  try { localStorage.setItem(LAST_PROJECT_KEY, project.id); } catch { /* noop */ }
  try {
    const { recordVersion } = await import('./versions');
    await recordVersion(project, opts.versionLabel ?? 'Autosave', { force: opts.forceVersion });
  } catch { /* version history is best-effort */ }
}

export const PALETTE_LIST = PALETTES;

export function pickDefaultProjectName(prompt: string) {
  const clean = prompt.replace(/[#*`]/g, '').trim();
  const words = clean.split(/\s+/).slice(0, 5).join(' ');
  return words || 'Untitled project';
}
