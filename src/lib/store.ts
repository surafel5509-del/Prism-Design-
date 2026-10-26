import { create } from "zustand";
import { nanoid } from "nanoid";
import type { AgentOp, Keyframe, Layer, PrismProject } from "./types";
import { emptyProject, makeLayer } from "./layers";

export type ToolId = "select" | "hand" | "rect" | "ellipse" | "polygon" | "star" | "text" | "image";
export type LeftTab = "layers" | "assets" | "templates" | "brand" | "effects";

interface EditorState {
  project: PrismProject;
  selectedIds: string[];
  currentTime: number;
  playing: boolean;
  loop: boolean;
  zoom: number;
  tool: ToolId;
  leftTab: LeftTab;
  showAI: boolean;
  showGrid: boolean;
  snap: boolean;
  saveState: "saved" | "saving" | "dirty";
  past: string[];
  future: string[];
  // actions
  setProject: (p: PrismProject, record?: boolean) => void;
  patchProject: (patch: Partial<PrismProject>) => void;
  addLayer: (layer: Layer, select?: boolean) => void;
  updateLayer: (id: string, patch: Partial<Layer>, record?: boolean) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  reorderLayer: (id: string, dir: 1 | -1) => void;
  addKeyframe: (layerId: string, kf: Keyframe) => void;
  removeKeyframe: (layerId: string, kfId: string) => void;
  select: (ids: string[]) => void;
  setTime: (t: number) => void;
  setPlaying: (playing: boolean) => void;
  setZoom: (z: number) => void;
  setTool: (t: ToolId) => void;
  setLeftTab: (t: LeftTab) => void;
  setShowAI: (v: boolean) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  applyOp: (op: AgentOp) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}

const HISTORY_LIMIT = 60;

function snapshot(p: PrismProject): string {
  return JSON.stringify(p);
}

export const useEditor = create<EditorState>((set, get) => ({
  project: emptyProject({ name: "Untitled Project" }),
  selectedIds: [],
  currentTime: 0,
  playing: false,
  loop: true,
  zoom: 1,
  tool: "select",
  leftTab: "layers",
  showAI: true,
  showGrid: false,
  snap: true,
  saveState: "saved",
  past: [],
  future: [],

  setProject: (p, record = true) => {
    const s = get();
    set({
      project: p,
      selectedIds: [],
      currentTime: 0,
      playing: false,
      saveState: "dirty",
      past: record ? [...s.past.slice(-HISTORY_LIMIT), snapshot(s.project)] : s.past,
      future: [],
    });
  },

  patchProject: (patch) =>
    set((s) => ({ project: { ...s.project, ...patch, updatedAt: new Date().toISOString() }, saveState: "dirty" })),

  addLayer: (layer, selectIt = true) => {
    get().pushHistory();
    set((s) => ({
      project: { ...s.project, layers: [...s.project.layers, layer], updatedAt: new Date().toISOString() },
      selectedIds: selectIt ? [layer.id] : s.selectedIds,
      saveState: "dirty",
    }));
  },

  updateLayer: (id, patch, record = false) => {
    if (record) get().pushHistory();
    set((s) => ({
      project: {
        ...s.project,
        layers: s.project.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        updatedAt: new Date().toISOString(),
      },
      saveState: "dirty",
    }));
  },

  deleteLayer: (id) => {
    get().pushHistory();
    set((s) => ({
      project: { ...s.project, layers: s.project.layers.filter((l) => l.id !== id) },
      selectedIds: s.selectedIds.filter((x) => x !== id),
      saveState: "dirty",
    }));
  },

  duplicateLayer: (id) => {
    const s = get();
    const src = s.project.layers.find((l) => l.id === id);
    if (!src) return;
    const copy = makeLayer({
      ...JSON.parse(JSON.stringify(src)),
      id: nanoid(10),
      name: `${src.name} copy`,
      x: src.x + 24,
      y: src.y + 24,
    });
    get().addLayer(copy);
  },

  reorderLayer: (id, dir) => {
    get().pushHistory();
    set((s) => {
      const layers = [...s.project.layers];
      const i = layers.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= layers.length) return s;
      [layers[i], layers[j]] = [layers[j], layers[i]];
      return { project: { ...s.project, layers }, saveState: "dirty" as const };
    });
  },

  addKeyframe: (layerId, kf) => {
    set((s) => ({
      project: {
        ...s.project,
        layers: s.project.layers.map((l) =>
          l.id === layerId
            ? { ...l, keyframes: [...l.keyframes.filter((k) => !(k.property === kf.property && Math.abs(k.time - kf.time) < 1e-4)), kf] }
            : l,
        ),
      },
      saveState: "dirty",
    }));
  },

  removeKeyframe: (layerId, kfId) =>
    set((s) => ({
      project: {
        ...s.project,
        layers: s.project.layers.map((l) => (l.id === layerId ? { ...l, keyframes: l.keyframes.filter((k) => k.id !== kfId) } : l)),
      },
      saveState: "dirty",
    })),

  select: (ids) => set({ selectedIds: ids }),
  setTime: (t) => set((s) => ({ currentTime: Math.max(0, Math.min(s.project.duration, t)) })),
  setPlaying: (playing) => set({ playing }),
  setZoom: (z) => set({ zoom: Math.max(0.05, Math.min(4, z)) }),
  setTool: (tool) => set({ tool }),
  setLeftTab: (leftTab) => set({ leftTab }),
  setShowAI: (showAI) => set({ showAI }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),

  applyOp: (op) => {
    const s = get();
    switch (op.op) {
      case "create_project": {
        const p = emptyProject({ ...op.project, id: s.project.id, layers: [] });
        s.setProject(p);
        break;
      }
      case "set_background":
        s.patchProject({ background: op.background, backgroundGradient: op.gradient ?? null });
        break;
      case "add_layer":
        // Replace if the agent re-sends the same id (idempotent streaming).
        set((st) => ({
          project: {
            ...st.project,
            layers: [...st.project.layers.filter((l) => l.id !== op.layer.id), op.layer],
          },
          saveState: "dirty",
        }));
        break;
      case "update_layer":
        s.updateLayer(op.layerId, op.patch);
        break;
      case "delete_layer":
        set((st) => ({ project: { ...st.project, layers: st.project.layers.filter((l) => l.id !== op.layerId) }, saveState: "dirty" }));
        break;
      case "add_keyframe":
        s.addKeyframe(op.layerId, op.keyframe);
        break;
      case "add_effect":
        set((st) => ({
          project: {
            ...st.project,
            layers: st.project.layers.map((l) => (l.id === op.layerId ? { ...l, effects: [...l.effects, op.effect] } : l)),
          },
          saveState: "dirty",
        }));
        break;
      case "set_duration":
        s.patchProject({ duration: op.duration });
        break;
      case "set_brand_kit":
        s.patchProject({ brandKit: { ...s.project.brandKit, ...op.brandKit } });
        break;
      case "note":
        break;
    }
  },

  pushHistory: () =>
    set((s) => ({ past: [...s.past.slice(-HISTORY_LIMIT), snapshot(s.project)], future: [] })),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s;
      const prev = s.past[s.past.length - 1];
      return {
        project: JSON.parse(prev) as PrismProject,
        past: s.past.slice(0, -1),
        future: [snapshot(s.project), ...s.future],
        selectedIds: [],
        saveState: "dirty" as const,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const [next, ...rest] = s.future;
      return {
        project: JSON.parse(next) as PrismProject,
        past: [...s.past, snapshot(s.project)],
        future: rest,
        selectedIds: [],
        saveState: "dirty" as const,
      };
    }),

  markSaved: () => set({ saveState: "saved" }),
}));

export function selectedLayer(): Layer | undefined {
  const s = useEditor.getState();
  return s.project.layers.find((l) => l.id === s.selectedIds[0]);
}
