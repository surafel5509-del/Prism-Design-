// ─────────────────────────────────────────────────────────────────────────────
// PRISM core document model — a layered, keyframeable, motion-graphics scene.
// Shared by the renderer, the editor store, the agent tools and exporters.
// ─────────────────────────────────────────────────────────────────────────────

export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference'
  | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

export type EasingType =
  | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bezier'
  | 'spring' | 'bounce' | 'elastic' | 'stepStart' | 'stepEnd' | 'hold';

export interface Easing {
  type: EasingType;
  bezier?: [number, number, number, number];
  stiffness?: number;
  damping?: number;
}

export type PropValue = number | string | [number, number];

export interface Keyframe {
  id: string;
  time: number;
  value: PropValue;
  easing?: Easing;
}

export type AnimatableProp =
  | 'x' | 'y' | 'w' | 'h' | 'rotation' | 'scaleX' | 'scaleY'
  | 'opacity' | 'cornerRadius' | 'fontSize' | 'letterSpacing' | 'strokeWidth'
  | 'blur' | 'brightness' | 'saturate' | 'hue';

export type Keyframes = Partial<Record<AnimatableProp, Keyframe[]>>;

export type LayerType = 'shape' | 'text' | 'image' | 'video' | 'audio' | 'group' | 'path' | 'lottie' | 'particles';

export type ShapeKind =
  | 'rect' | 'roundedRect' | 'ellipse' | 'polygon' | 'star' | 'line' | 'arrow' | 'triangle' | 'diamond' | 'hexagon'
  | 'capsule' | 'squircle' | 'ring' | 'halfCircle' | 'quarterCircle' | 'chevron' | 'cross' | 'parallelogram'
  | 'trapezoid' | 'burst' | 'heart' | 'cloud' | 'wave' | 'octagon' | 'pentagon' | 'pillArrow';

export interface GradientStop { offset: number; color: string; opacity?: number }
export interface Gradient {
  type: 'linear' | 'radial' | 'conic';
  angle?: number;
  stops: GradientStop[];
}

export type EffectType =
  | 'blur' | 'glow' | 'shadow' | 'brightness' | 'contrast' | 'saturate' | 'hue'
  | 'grayscale' | 'sepia' | 'invert' | 'chromatic' | 'noise' | 'grain' | 'vignette'
  | 'lightSweep' | 'pixelate' | 'bloom' | 'dropShadow' | 'displacement' | 'scanlines'
  | 'duotone' | 'hologram' | 'vhs' | 'halftone' | 'spotlight'
  | 'thermal' | 'posterize' | 'wiggle' | 'drift' | 'beatPulse';

export interface Effect {
  id: string;
  type: EffectType;
  enabled: boolean;
  amount: number;
  color?: string;
  color2?: string;
  x?: number;
  y?: number;
  blur?: number;
  speed?: number;
}

export interface TextProps {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: 'normal' | 'italic';
  lineHeight: number;
  letterSpacing: number;
  align: 'left' | 'center' | 'right';
  color: string;
  gradient?: Gradient | null;
  uppercase?: boolean;
  stroke?: string;
  strokeWidth?: number;
  underline?: boolean;
  animator?: TextAnimator | null;
  padding?: number;
}

export interface TextAnimator {
  type: 'typewriter' | 'wordReveal' | 'charRise' | 'slideUp' | 'blurIn' | 'scaleIn';
  duration: number;
  stagger: number;
  delay: number;
}

export interface MediaProps {
  src: string;
  fit: 'cover' | 'contain' | 'fill';
  radius?: number;
  opacity?: number;
  objectPosition?: string;
  muted?: boolean;
  loop?: boolean;
  volume?: number;
  trimStart?: number;
  trimEnd?: number;
  playbackRate?: number;
}

export interface Mask {
  type: 'rect' | 'ellipse' | 'gradient';
  feather: number;
  inverted?: boolean;
  angle?: number;
}

export interface MotionPath {
  points: [number, number][];
  closed?: boolean;
  orient?: boolean;
  progress?: number;
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
  anchorX: number;
  anchorY: number;
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
  locked: boolean;
  fill: string;
  fillGradient?: Gradient | null;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  shape?: ShapeKind;
  points?: number;
  innerRadius?: number;
  text?: TextProps;
  media?: MediaProps;
  path?: string;
  effects: Effect[];
  keyframes: Keyframes;
  parentId?: string | null;
  startTime: number;
  endTime: number;
  mask?: Mask | null;
  /** Manual painted alpha cut-out from the background remover (never automatic). */
  cutout?: { src: string; mode: 'remove' | 'keep' } | null;
  motionPath?: MotionPath | null;
  particles?: ParticlesProps | null;
  meta?: Record<string, unknown>;
}

export interface ParticlesProps {
  count: number;
  shape: 'circle' | 'square' | 'star';
  color: string;
  size: number;
  speed: number;
  spread: number;
  gravity: number;
  seed?: number;
}

export interface BrandKit {
  id: string;
  name: string;
  colors: string[];
  secondaryColors?: string[];
  fonts: { heading: string; body: string; mono?: string };
  logo?: string | null;
  voice?: string;
  radius?: number;
  style?: string;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  background: string;
  backgroundGradient?: Gradient | null;
  layers: Layer[];
  brandKitId?: string | null;
  folderId?: string | null;
  tags: string[];
  thumbnail?: string | null;
  description?: string;
  createdAt: number;
  updatedAt: number;
  ownerId?: string | null;
  version?: number;
}

export type Aspect = '16:9' | '9:16' | '1:1' | '4:5';

export interface TemplateDef {
  id: string;
  name: string;
  category: 'Social' | 'Motion' | 'Presentation' | 'Ad' | 'Logo' | 'Poster' | 'Story' | 'YouTube' | 'TikTok' | 'Lower Third';
  tags: string[];
  aspect: Aspect;
  duration: number;
  palette: string[];
  font: string;
  pro?: boolean;
  render: () => {
    layers: Layer[];
    width: number;
    height: number;
    background: string;
    backgroundGradient?: Gradient | null;
  };
}

export interface AIProviderConfig {
  provider: string;
  apiKeyMasked: string;
  connected: boolean;
  status: 'connected' | 'error' | 'unconfigured' | 'testing';
  message?: string;
  baseUrl?: string;
  lastChecked?: number;
  models?: ModelInfo[];
  usage?: { requests: number; tokens: number; cost: number };
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  capabilities: ('tools' | 'vision' | 'reasoning' | 'image' | 'audio')[];
  inputCost: number;
  outputCost: number;
  curated?: boolean;
}

export const ASPECTS = {
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
  '4:3': { w: 1440, h: 1080 },
  '3:2': { w: 1620, h: 1080 },
} as const;
