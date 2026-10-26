/**
 * PRISM core document model.
 * A project is a timed composition of layers. Every layer has base transform
 * values plus keyframes that override animatable properties at time `t`.
 */

export type LayerType =
  | "text"
  | "rect"
  | "ellipse"
  | "polygon"
  | "star"
  | "line"
  | "image"
  | "group";

export type AnimatableProperty = "x" | "y" | "scale" | "scaleX" | "scaleY" | "rotation" | "opacity";

export type EasingName =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "easeOutCubic"
  | "easeInOutCubic"
  | "easeOutBack"
  | "easeOutElastic"
  | "easeOutBounce"
  | "spring";

export interface Keyframe {
  id: string;
  /** seconds, absolute composition time */
  time: number;
  property: AnimatableProperty;
  value: number;
  easing: EasingName;
}

export interface LayerEffect {
  id: string;
  type: "shadow" | "glow" | "blur" | "outline";
  /** shadow/glow color, etc. */
  color?: string;
  blur?: number;
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
}

export interface GradientFill {
  kind: "linear" | "radial" | "conic";
  angle?: number;
  stops: { offset: number; color: string }[];
}

export interface Layer {
  id: string;
  type: LayerType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  scale: number;
  visible: boolean;
  locked: boolean;
  /** clip window on the timeline (seconds) */
  startTime: number;
  duration: number;
  fill: string;
  gradient?: GradientFill | null;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  blendMode: string;
  // text
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  letterSpacing?: number;
  lineHeight?: number;
  align?: "left" | "center" | "right";
  // shape
  points?: number; // polygon/star points
  innerRadius?: number; // star 0..1
  // image
  src?: string;
  keyframes: Keyframe[];
  effects: LayerEffect[];
  parentId?: string | null;
}

export interface BrandKit {
  name: string;
  colors: string[];
  fonts: { display: string; body: string };
  voice: string;
}

export interface PrismProject {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  /** seconds */
  duration: number;
  background: string;
  backgroundGradient?: GradientFill | null;
  layers: Layer[];
  brandKit: BrandKit;
  createdAt: string;
  updatedAt: string;
  templateId?: string;
}

export interface EvaluatedLayer extends Layer {
  _x: number;
  _y: number;
  _scale: number;
  _scaleX: number;
  _scaleY: number;
  _rotation: number;
  _opacity: number;
  _active: boolean;
}

/** Agent operation — the unit streamed from server tool results to the client store. */
export type AgentOp =
  | { op: "create_project"; project: Partial<PrismProject> & { name: string } }
  | { op: "set_background"; background: string; gradient?: GradientFill | null }
  | { op: "add_layer"; layer: Layer }
  | { op: "update_layer"; layerId: string; patch: Partial<Layer> }
  | { op: "delete_layer"; layerId: string }
  | { op: "add_keyframe"; layerId: string; keyframe: Keyframe }
  | { op: "add_effect"; layerId: string; effect: LayerEffect }
  | { op: "set_duration"; duration: number }
  | { op: "set_brand_kit"; brandKit: Partial<BrandKit> }
  | { op: "note"; message: string };

export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "openrouter"
  | "deepseek"
  | "groq"
  | "together"
  | "fireworks"
  | "ollama"
  | "custom";

export type Capability = "tools" | "vision" | "reasoning" | "image-gen";

export interface ModelInfo {
  id: string;
  label: string;
  capabilities: Capability[];
  contextWindow?: string;
  costHint?: string;
  source: "curated" | "live";
}

export interface ProviderStatus {
  provider: ProviderId;
  connected: boolean;
  source: "saved" | "env" | null;
  maskedKey: string | null;
  baseURL: string | null;
  isDefault: boolean;
  updatedAt: string | null;
}

export type AgentMode = "agent" | "thinking" | "fast";
export type TaskKind = "design" | "motion" | "image" | "edit";

export interface AgentRunEvent {
  type:
    | "run-start"
    | "text-delta"
    | "reasoning-delta"
    | "tool-call"
    | "tool-result"
    | "step-finish"
    | "usage"
    | "error"
    | "done";
  [key: string]: unknown;
}
