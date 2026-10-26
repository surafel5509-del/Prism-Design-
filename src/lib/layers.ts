import { nanoid } from "nanoid";
import type { BrandKit, Keyframe, Layer, PrismProject } from "./types";

export const DEFAULT_BRAND: BrandKit = {
  name: "Prism Default",
  colors: ["#7c3aed", "#06b6d4", "#d946ef", "#f8fafc", "#0b0b14"],
  fonts: { display: "Space Grotesk", body: "Inter" },
  voice: "Bold, modern, confident",
};

export function makeLayer(partial: Partial<Layer> & Pick<Layer, "type">): Layer {
  return {
    id: partial.id ?? nanoid(10),
    name: partial.name ?? defaultName(partial.type),
    x: 0,
    y: 0,
    width: 400,
    height: 200,
    rotation: 0,
    opacity: 1,
    scale: 1,
    visible: true,
    locked: false,
    startTime: 0,
    duration: 5,
    fill: "#7c3aed",
    gradient: null,
    stroke: "transparent",
    strokeWidth: 0,
    cornerRadius: 0,
    blendMode: "normal",
    fontSize: 64,
    fontFamily: "Space Grotesk",
    fontWeight: 700,
    letterSpacing: 0,
    lineHeight: 1.1,
    align: "center",
    points: 5,
    innerRadius: 0.5,
    keyframes: [],
    effects: [],
    parentId: null,
    ...partial,
  };
}

function defaultName(type: Layer["type"]): string {
  return { text: "Text", rect: "Rectangle", ellipse: "Ellipse", polygon: "Polygon", star: "Star", line: "Line", image: "Image", group: "Group" }[type];
}

let kfCounter = 0;
export function makeKeyframe(partial: Omit<Keyframe, "id"> & { id?: string }): Keyframe {
  return { id: partial.id ?? `kf_${nanoid(8)}_${kfCounter++}`, ...partial };
}

export function emptyProject(partial?: Partial<PrismProject>): PrismProject {
  const now = new Date().toISOString();
  return {
    id: partial?.id ?? nanoid(12),
    name: "Untitled Project",
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 6,
    background: "#0b0b14",
    backgroundGradient: null,
    layers: [],
    brandKit: DEFAULT_BRAND,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export const CANVAS_PRESETS = [
  { id: "hd", label: "HD 1920×1080", width: 1920, height: 1080 },
  { id: "4k", label: "4K 3840×2160", width: 3840, height: 2160 },
  { id: "ig-post", label: "Instagram Post 1080×1080", width: 1080, height: 1080 },
  { id: "ig-story", label: "Story / Reels / TikTok 1080×1920", width: 1080, height: 1920 },
  { id: "yt-thumb", label: "YouTube Thumbnail 1280×720", width: 1280, height: 720 },
  { id: "poster", label: "Poster 1240×1754", width: 1240, height: 1754 },
  { id: "banner", label: "Web Banner 1600×600", width: 1600, height: 600 },
];

export const FONT_FAMILIES = [
  "Space Grotesk",
  "Inter",
  "Montserrat",
  "Playfair Display",
  "Bebas Neue",
  "Archivo",
  "Sora",
  "DM Sans",
  "JetBrains Mono",
  "Poppins",
];

export const BLEND_MODES = ["normal", "multiply", "screen", "overlay", "soft-light", "hard-light", "difference", "exclusion", "luminosity", "color-dodge"];
