import { tool } from 'ai';
import { z } from 'zod';
import type { AnimatableProp, Aspect, BlendMode, Easing, Gradient, Keyframe, Layer, Project, ShapeKind, TextAnimator } from '@/lib/engine/types';
import { ASPECTS } from '@/lib/engine/types';
import type { Op } from '@/lib/engine/ops';
import { applyOps, newEffect } from '@/lib/engine/ops';
import { createImage, createLayer, createShape, createText, gradient } from '@/lib/engine/factory';
import { ANIMATION_PRESETS, applyPresetToLayer } from '@/lib/engine/presets';
import { getTemplates } from '@/lib/data/templates';
import { FONTS, MUSIC, SFX, iconToDataUrl, loadIcons, makeBackdrop } from '@/lib/data/library';

const MUSIC_TRACKS = [...MUSIC, ...SFX];
import { saveGenerated } from '@/lib/server/generated';
import type { AgentAction } from './bus';
import { buildDesign, buildMotionComposition, captionLayers, copyFromBrief, imageMotionLayers, pickFont, pickPalette, smartReframeOps } from './skills';
import { uid } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  PRISM agent toolbelt                                                       */
/*  Every tool performs a real, deterministic mutation. Ops are applied to a   */
/*  server-side copy immediately (later tool calls see the result) and are     */
/*  streamed back to the editor, which applies the exact same ops in order.    */
/* -------------------------------------------------------------------------- */

export interface ToolOutput {
  ok: boolean;
  summary: string;
  ops?: Op[];
  data?: unknown;
  error?: string;
  clientAction?: AgentAction;
}

export interface ToolBeltDeps {
  project: Project;
  userId: string;
  signal?: AbortSignal;
  generateImage?: (args: { prompt: string; size: string; quality?: string }) => Promise<{ dataUrl: string; model: string; revisedPrompt?: string }>;
  generateSpeech?: (args: { text: string; voice?: string }) => Promise<{ dataUrl: string; model: string }>;
  vision?: (args: { prompt: string; image: string }) => Promise<string>;
  onOps?: (ops: Op[], summary: string) => void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function createToolbelt(deps: ToolBeltDeps) {
  const state = { project: deps.project, ops: [] as Op[], tools: 0 };

  const commit = (ops: Op[], summary: string): Op[] => {
    if (!ops.length) return [];
    const res = applyOps(state.project, ops);
    state.project = res.project;
    const failed = res.results.filter((r) => !r.ok);
    if (failed.length) console.warn('[prism] ops failed', failed.map((f) => f.message));
    state.ops.push(...ops);
    deps.onOps?.(ops, summary);
    return ops;
  };

  const done = (summary: string, ops: Op[], extra: Partial<ToolOutput> = {}): ToolOutput => ({ ok: true, summary, ops, ...extra });
  const nope = (summary: string): ToolOutput => ({ ok: false, summary, error: summary });

  const W = () => state.project.width;
  const H = () => state.project.height;
  /** fractions of the canvas → design px */
  const fx = (v: number | undefined, base: number, fallback = 0) => Math.round(clamp(v ?? fallback, -2, 4) * base);

  const find = (ref: string): Layer | undefined => {
    const l = state.project.layers;
    return l.find((x) => x.id === ref)
      ?? l.find((x) => x.name.toLowerCase() === ref.toLowerCase())
      ?? l.find((x) => x.name.toLowerCase().includes(ref.toLowerCase()));
  };
  const refs = (list: string[]) => list.map(find).filter((l): l is Layer => Boolean(l));

  const ts = (t: number) => clamp(t, 0, state.project.duration);

  const ease = (name?: string, bezier?: number[]): Easing => {
    if (bezier?.length === 4) return { type: 'bezier', bezier: bezier as [number, number, number, number] };
    switch (name) {
      case 'linear': return { type: 'linear' };
      case 'easeIn': return { type: 'easeIn' };
      case 'easeOut': return { type: 'easeOut' };
      case 'expo': return { type: 'bezier', bezier: [0.16, 1, 0.3, 1] };
      case 'spring': return { type: 'spring' };
      case 'bounce': return { type: 'bounce' };
      case 'elastic': return { type: 'elastic' };
      default: return { type: 'easeInOut' };
    }
  };

  const kf = (time: number, value: Keyframe['value'], easing?: Easing): Keyframe => ({ id: uid('kf'), time: ts(time), value, easing: easing ?? { type: 'easeInOut' } });

  const layerLine = (l: Layer) =>
    `${l.name} [${l.type}${l.text ? `: “${l.text.content.slice(0, 32)}”` : ''}]${Object.keys(l.keyframes).length ? ' (animated)' : ''}`;

  const COLOR = z.string().regex(/^(#[0-9a-fA-F]{3,8}|rgba?\([\d.,\s%]+\)|transparent)$/).describe('CSS color, e.g. #ff2bd6');

  /* ══════════════════════════ planning & conversation ══════════════════════ */

  const setPlan = tool({
    description: 'Announce your plan BEFORE building. 3–6 concrete steps that name the tools you will call. The user sees this as a live checklist. Call once per run.',
    parameters: z.object({
      summary: z.string().min(4).max(320).describe('One sentence: what you are about to build'),
      steps: z.array(z.object({ title: z.string().min(2).max(90), detail: z.string().max(180).optional() })).min(2).max(8),
    }),
    execute: async ({ summary, steps }): Promise<ToolOutput> => ({
      ok: true,
      summary: `Plan: ${summary}`,
      clientAction: { type: 'plan', summary, steps: steps.map((s) => ({ title: s.title, detail: s.detail })) },
      data: { steps: steps.length },
    }),
  });

  const completeStep = tool({
    description: 'Mark a plan step complete (0-based). Call it as you finish each step so progress and ETA stay truthful.',
    parameters: z.object({ index: z.number().int().min(0).max(20), note: z.string().max(160).optional() }),
    execute: async ({ index, note }): Promise<ToolOutput> => ({
      ok: true, summary: `Step ${index + 1} done${note ? ` — ${note}` : ''}`,
      clientAction: { type: 'step', index, note },
    }),
  });

  const askUser = tool({
    description: 'Ask the user one blocking question or request approval of the plan. Use at most once per run and only for a decision that materially changes the work. The run pauses until they answer.',
    parameters: z.object({
      question: z.string().min(4).max(260),
      options: z.array(z.string().min(1).max(80)).min(2).max(5),
      kind: z.enum(['question', 'approval']).default('question'),
      reason: z.string().max(180).optional(),
    }),
    execute: async ({ question, options, kind, reason }): Promise<ToolOutput> => ({
      ok: true,
      summary: kind === 'approval' ? 'Waiting for plan approval…' : `Asked: ${question}`,
      clientAction: { type: 'ask', kind, question, options, reason },
      data: { waiting: true },
    }),
  });

  const getState = tool({
    description: 'Read the current document: canvas size, duration, every layer with id/name/type/position and animation, plus the selected layer. Always call this before editing when the request refers to existing content.',
    parameters: z.object({ verbose: z.boolean().default(false) }),
    execute: async ({ verbose }): Promise<ToolOutput> => {
      const p = state.project;
      const layers = p.layers.map((l) => {
        const animated = Object.entries(l.keyframes).filter(([, v]) => v?.length).map(([k]) => k);
        return {
          id: l.id, name: l.name, type: l.type,
          x: Math.round(l.x), y: Math.round(l.y), w: Math.round(l.w), h: Math.round(l.h),
          opacity: l.opacity, text: l.text?.content, font: l.text ? `${l.text.fontFamily} ${l.text.fontWeight} ${l.text.fontSize}` : undefined,
          start: l.startTime, end: l.endTime, animated, effects: l.effects.map((e) => e.type), parent: l.parentId,
        };
      });
      return {
        ok: true,
        summary: `${p.layers.length} layers on a ${p.width}×${p.height} canvas, ${p.duration}s @${p.fps}fps. ${animatedCount(layers)} animated.`,
        data: {
          project: { id: p.id, name: p.name, width: p.width, height: p.height, fps: p.fps, duration: p.duration, background: p.background, gradient: Boolean(p.backgroundGradient) },
          layers: verbose ? layers : layers.slice(0, 30),
          truncated: !verbose && layers.length > 30,
        },
      };
    },
  });

  /* ══════════════════════════ project & compositions ═══════════════════════ */

  const aspectSize = (aspect: keyof typeof ASPECTS, fallback: [number, number]): [number, number] => {
    const s = ASPECTS[aspect];
    return s ? [s.w, s.h] : fallback;
  };

  const resetDoc = (patch: Partial<Omit<Project, 'layers'>>, layers: Layer[]) => {
    const ops: Op[] = [{ op: 'delete_layers', ids: state.project.layers.map((l) => l.id) }];
    if (layers.length) ops.push({ op: 'add_layers', layers });
    ops.push({ op: 'set_project', patch });
    const res = applyOps(state.project, ops);
    state.project = res.project;
    state.ops.push(...ops);
    return ops;
  };

  const createProjectTool = tool({
    description: 'Start a fresh composition at the right size — e.g. 16:9 for YouTube, 9:16 for Reels/TikTok, 1:1 for feed, 4:5 for portrait. Replaces the current canvas (existing layers are removed).',
    parameters: z.object({
      name: z.string().min(1).max(120).default('Untitled motion'),
      aspect: z.enum(['16:9', '9:16', '1:1', '4:5', '4:3', '3:2']).default('16:9'),
      duration: z.number().min(0.5).max(600).default(8),
      fps: z.number().int().min(12).max(60).default(30),
      background: COLOR.default('#0b0b12'),
      gradientColors: z.array(COLOR).min(2).max(4).optional(),
      gradientAngle: z.number().default(135),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const [width, height] = aspectSize(a.aspect as keyof typeof ASPECTS, [1920, 1080]);
      const ops = resetDoc(
        { name: a.name, width, height, duration: a.duration, fps: a.fps, background: a.background, backgroundGradient: a.gradientColors ? gradient(a.gradientColors, a.gradientAngle) : null },
        [],
      );
      return done(`Created “${a.name}” — ${width}×${height}, ${a.duration}s @${a.fps}fps`, ops, { data: { width, height } });
    },
  });

  const generateDesignTool = tool({
    description: 'Build a complete designed layout (poster / social post / story / banner / thumbnail / presentation / ad / logo) from a template family, with palette, typography and copy filled in. This is the fastest strong starting point for static work — refine it with layer tools afterwards.',
    parameters: z.object({
      brief: z.string().min(4).max(1200),
      kind: z.enum(['poster', 'social', 'story', 'banner', 'thumbnail', 'presentation', 'ad', 'logo', 'lowerThird', 'motion']).default('poster'),
      aspect: z.enum(['16:9', '9:16', '1:1', '4:5', '4:3', '3:2']).optional(),
      palette: z.array(COLOR).min(2).max(5).optional(),
      font: z.string().optional(),
      family: z.string().optional().describe('Template family id when you want a specific look'),
      copy: z.object({
        kicker: z.string().optional(),
        headline: z.string().optional(),
        subhead: z.string().optional(),
        cta: z.string().optional(),
      }).optional(),
      duration: z.number().min(0.5).max(300).optional(),
      replace: z.boolean().default(true),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const design = buildDesign({
        brief: a.brief, kind: a.kind, aspect: (a.aspect ?? (a.kind === 'story' ? '9:16' : a.kind === 'poster' ? '4:5' : '1:1')) as Aspect,
        palette: a.palette, font: a.font, family: a.family, copy: a.copy,
      });
      const duration = a.duration ?? state.project.duration;
      const layers = design.layers.map((l) => ({ ...l, endTime: Math.min(l.endTime || duration, duration) }));
      const patch: Partial<Omit<Project, 'layers'>> = {
        width: design.width, height: design.height, background: design.background,
        backgroundGradient: design.backgroundGradient, duration,
      };
      const ops = a.replace || state.project.layers.length === 0
        ? resetDoc(patch, layers)
        : commit([{ op: 'add_layers', layers }, { op: 'set_project', patch }], 'Added design layers');
      state.tools += 1;
      return done(`Built a ${a.kind} from the “${design.template}” family — ${layers.length} layers, ${design.width}×${design.height}`, ops, {
        data: { template: design.template, layers: layers.map((l) => l.name), width: design.width, height: design.height },
      });
    },
  });

  const generateMotionTool = tool({
    description: 'Build a full animated composition — intro / promo / explainer / logo sting / reel — with a timed scene sequence (title, features, quote, CTA), real keyframes, transitions and background motion. Then refine timing with keyframe tools.',
    parameters: z.object({
      brief: z.string().min(4).max(1400),
      aspect: z.enum(['16:9', '9:16', '1:1', '4:5', '4:3', '3:2']).default('16:9'),
      duration: z.number().min(2).max(180).default(10),
      palette: z.array(COLOR).min(2).max(5).optional(),
      font: z.string().optional(),
      scenes: z.array(z.enum(['title', 'features', 'quote', 'cta'])).min(1).max(4).optional(),
      imageSrc: z.string().optional().describe('Hero image URL to composite into the scene'),
      copy: z.object({ kicker: z.string().optional(), headline: z.string().optional(), subhead: z.string().optional(), cta: z.string().optional() }).optional(),
      replace: z.boolean().default(true),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const [width, height] = aspectSize(a.aspect as keyof typeof ASPECTS, [1920, 1080]);
      const motion = buildMotionComposition({
        brief: a.brief, width, height, duration: a.duration, palette: a.palette, font: a.font, scenes: a.scenes, imageSrc: a.imageSrc, copy: a.copy,
      });
      const layers = motion.layers;
      const patch: Partial<Omit<Project, 'layers'>> = {
        width, height, duration: motion.duration, background: motion.background, backgroundGradient: motion.backgroundGradient, fps: 30,
      };
      const ops = a.replace || state.project.layers.length === 0
        ? resetDoc(patch, layers)
        : commit([{ op: 'add_layers', layers }, { op: 'set_project', patch }], 'Added motion layers');
      void clamp;
      const kfs = layers.reduce((n, l) => n + Object.values(l.keyframes).reduce((m, list) => m + (list?.length ?? 0), 0), 0);
      return done(`Built a ${a.duration}s ${a.aspect} motion piece — ${layers.length} layers, ${kfs} keyframes`, ops, {
        data: { layers: layers.length, keyframes: kfs, duration: motion.duration, width, height },
      });
    },
  });

  const applyTemplateTool = tool({
    description: 'Apply one of the built-in templates by name, category or search text. Use templates as a foundation — never as the finished answer.',
    parameters: z.object({
      query: z.string().min(2).max(80).describe('Template name, category or keyword, e.g. "sale", "Story", "YouTube intro"'),
      aspect: z.enum(['16:9', '9:16', '1:1', '4:5', '4:3', '3:2']).optional(),
      replace: z.boolean().default(true),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const q = a.query.toLowerCase();
      const all = getTemplates();
      const matches = all.filter((t) => `${t.name} ${t.category} ${t.tags.join(' ')}`.toLowerCase().includes(q) && (!a.aspect || t.aspect === a.aspect));
      const pool = matches.length ? matches : all.filter((t) => !a.aspect || t.aspect === a.aspect);
      if (!pool.length) return nope(`No template matched “${a.query}”.`);
      const template = pool[0];
      const rendered = template.render();
      const ops = a.replace || state.project.layers.length === 0
        ? resetDoc({
          name: template.name, width: rendered.width, height: rendered.height,
          background: rendered.background, backgroundGradient: rendered.backgroundGradient ?? null,
          duration: Math.max(template.duration, state.project.duration),
        }, rendered.layers)
        : commit([{ op: 'add_layers', layers: rendered.layers }], 'Added template layers');
      return done(`Applied template “${template.name}” (${template.category}, ${template.aspect}) — ${rendered.layers.length} layers`, ops, { data: { id: template.id, alternatives: pool.slice(1, 6).map((t) => t.name) } });
    },
  });

  const setCopyTool = tool({
    description: 'Replace headline / subhead / kicker / CTA across the existing text layers — keeps the layout and typography, swaps the words. Write real, specific copy.',
    parameters: z.object({
      kicker: z.string().max(80).optional(),
      headline: z.string().max(220).optional(),
      subhead: z.string().max(400).optional(),
      cta: z.string().max(60).optional(),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const texts = state.project.layers.filter((l) => l.type === 'text' && l.text);
      if (!texts.length) return nope('There are no text layers to update — add_text first.');
      const bySize = [...texts].sort((x, y) => (y.text?.fontSize ?? 0) - (x.text?.fontSize ?? 0));
      const ops: Op[] = [];
      if (a.headline && bySize[0]) ops.push({ op: 'update_layer', id: bySize[0].id, patch: { name: a.headline.slice(0, 28), text: { ...bySize[0].text!, content: a.headline } } });
      if (a.subhead && bySize[1]) ops.push({ op: 'update_layer', id: bySize[1].id, patch: { text: { ...bySize[1].text!, content: a.subhead } } });
      const small = bySize[bySize.length - 1];
      if (a.kicker && small && small.id !== bySize[0]?.id) ops.push({ op: 'update_layer', id: small.id, patch: { text: { ...small.text!, content: a.kicker, uppercase: true, letterSpacing: 4 } } });
      if (a.cta && bySize[2]) ops.push({ op: 'update_layer', id: bySize[2].id, patch: { text: { ...bySize[2].text!, content: a.cta } } });
      if (!ops.length) return nope('Nothing could be mapped to a text layer.');
      return done(`Updated copy on ${ops.length} text layer${ops.length === 1 ? '' : 's'}`, commit(ops, 'Updated copy'));
    },
  });

  /* ══════════════════════════════ primitives ═══════════════════════════════ */

  const addShapeTool = tool({
    description: 'Add a vector shape. x/y/w/h are canvas fractions, with the origin at the top-left. Use gradientColors for rich fills; use an enormous h/w with slight rotation for full-bleed diagonal panels.',
    parameters: z.object({
      shape: z.enum(['rect', 'roundedRect', 'ellipse', 'polygon', 'star', 'triangle', 'diamond', 'hexagon', 'line', 'arrow']).default('rect'),
      x: z.number().default(0.1), y: z.number().default(0.1), w: z.number().default(0.3), h: z.number().default(0.2),
      fill: COLOR.default('#8b5cf6'),
      gradientColors: z.array(COLOR).min(2).max(5).optional(),
      gradientAngle: z.number().default(135),
      radius: z.number().min(0).max(600).default(0),
      stroke: COLOR.optional(), strokeWidth: z.number().min(0).max(40).default(0),
      rotation: z.number().default(0), opacity: z.number().min(0).max(1).default(1),
      blendMode: z.string().default('normal'), points: z.number().int().min(3).max(24).optional(),
      name: z.string().max(60).optional(),
      blur: z.number().min(0).max(120).optional(),
      shadow: z.boolean().default(false),
      glow: z.number().min(0).max(100).optional(),
      start: z.number().min(0).default(0), end: z.number().min(0).optional(),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const effects = [
        ...(a.blur ? [newEffect('blur', a.blur)] : []),
        ...(a.shadow ? [newEffect('dropShadow', 40)] : []),
        ...(a.glow ? [newEffect('glow', a.glow)] : []),
      ];
      const layer = createShape(a.shape as ShapeKind, {
        name: a.name ?? `${a.shape[0].toUpperCase()}${a.shape.slice(1)}`,
        x: fx(a.x, W()), y: fx(a.y, H()), w: fx(a.w, W(), 0.3), h: fx(a.h, H(), 0.2),
        fill: a.fill, fillGradient: a.gradientColors ? gradient(a.gradientColors, a.gradientAngle) : null,
        radius: a.radius, stroke: a.stroke, strokeWidth: a.strokeWidth, rotation: a.rotation, opacity: a.opacity,
        blendMode: a.blendMode as BlendMode, points: a.points, startTime: ts(a.start), endTime: ts(a.end ?? state.project.duration), effects,
      });
      return done(`Added ${a.shape} “${layer.name}” (${layer.w}×${layer.h})`, commit([{ op: 'add_layers', layers: [layer] }], 'Added shape'), { data: { id: layer.id } });
    },
  });

  const addTextTool = tool({
    description: 'Add a text layer. x/y/w are canvas fractions; fontSize is design pixels (e.g. 120 for a headline on 1080p portrait). Width drives wrapping. Write specific copy, never lorem ipsum.',
    parameters: z.object({
      content: z.string().min(1).max(600),
      x: z.number().default(0.08), y: z.number().default(0.4), w: z.number().min(0.05).max(1.2).default(0.84),
      h: z.number().min(0.02).max(1).optional(),
      fontSize: z.number().min(6).max(800).default(96),
      fontFamily: z.string().default('Inter'),
      fontWeight: z.number().int().min(100).max(900).default(700),
      color: COLOR.default('#ffffff'),
      align: z.enum(['left', 'center', 'right']).default('left'),
      lineHeight: z.number().min(0.6).max(2.5).default(1.05),
      letterSpacing: z.number().min(-20).max(60).default(-1.5),
      uppercase: z.boolean().default(false),
      strokeWidth: z.number().min(0).max(20).default(0),
      rotation: z.number().default(0), opacity: z.number().min(0).max(1).default(1),
      animator: z.enum(['typewriter', 'charRise', 'wordReveal', 'counter', 'wave']).optional(),
      gradientColors: z.array(COLOR).min(2).max(4).optional(),
      shadow: z.boolean().default(false),
      name: z.string().max(60).optional(),
      start: z.number().min(0).default(0), end: z.number().min(0).optional(),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = createText(a.content, {
        name: a.name ?? a.content.slice(0, 28),
        x: fx(a.x, W()), y: fx(a.y, H()), w: fx(a.w, W(), 0.84),
        h: a.h ? fx(a.h, H(), 0.2) : undefined,
        rotation: a.rotation, opacity: a.opacity,
        startTime: ts(a.start), endTime: ts(a.end ?? state.project.duration),
        effects: a.shadow ? [newEffect('dropShadow', 35)] : [],
      }, {
        fontSize: Math.round(a.fontSize * (W() / 1080)),
        fontFamily: a.fontFamily, fontWeight: a.fontWeight, color: a.color, align: a.align,
        lineHeight: a.lineHeight, letterSpacing: a.letterSpacing, uppercase: a.uppercase, strokeWidth: a.strokeWidth,
        gradient: a.gradientColors ? gradient(a.gradientColors, 90) : null,
        animator: a.animator ? ({ type: a.animator, duration: 0.9, stagger: 0.04, delay: 0.08 } as TextAnimator) : null,
      });
      return done(`Added text “${a.content.slice(0, 44)}${a.content.length > 44 ? '…' : ''}”`, commit([{ op: 'add_layers', layers: [layer] }], 'Added text'), { data: { id: layer.id } });
    },
  });

  const addImageTool = tool({
    description: 'Add an image layer from a URL (https, /api/assets/… path, data URL). x/y/w/h are canvas fractions; use fit "cover" for full bleed and "contain" for logos. Add a radius for soft cards.',
    parameters: z.object({
      src: z.string().min(4),
      x: z.number().default(0), y: z.number().default(0), w: z.number().default(1), h: z.number().default(1),
      fit: z.enum(['cover', 'contain', 'fill']).default('cover'),
      radius: z.number().min(0).max(600).default(0), opacity: z.number().min(0).max(1).default(1),
      rotation: z.number().default(0), name: z.string().max(60).optional(),
      start: z.number().min(0).default(0), end: z.number().min(0).optional(),
    }),
    execute: async (a): Promise<ToolOutput> => {
      if (!/^(https?:\/\/|\/api\/assets\/|data:image\/|blob:|\/)/.test(a.src)) return nope('Image src must be an http(s) URL, an /api/assets path, or an image data URL.');
      const layer = createImage(a.src, {
        name: a.name ?? 'Image',
        x: fx(a.x, W()), y: fx(a.y, H()), w: fx(a.w, W(), 1), h: fx(a.h, H(), 1),
        radius: a.radius, opacity: a.opacity, rotation: a.rotation,
        startTime: ts(a.start), endTime: ts(a.end ?? state.project.duration),
        media: { src: a.src, fit: a.fit },
      });
      return done(`Added image (${a.fit}) at ${Math.round(a.w * 100)}% width`, commit([{ op: 'add_layers', layers: [layer] }], 'Added image'), { data: { id: layer.id } });
    },
  });

  const addIconTool = tool({
    description: 'Insert a real Lucide vector icon (1,544 available). Search with a single noun — "play", "heart", "chart", "lock", "arrow-right". Rendered as crisp SVG.',
    parameters: z.object({
      query: z.string().min(2).max(60),
      x: z.number().default(0.08), y: z.number().default(0.08), size: z.number().min(0.01).max(0.9).default(0.06),
      color: COLOR.default('#ffffff'), strokeWidth: z.number().min(0.5).max(4).default(1.75),
      opacity: z.number().min(0).max(1).default(1),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const icons = await loadIcons();
      const q = a.query.toLowerCase().replace(/\s+/g, '-');
      const scored = Object.keys(icons)
        .map((name) => ({ name, score: name === q ? 120 : name.startsWith(q) ? 90 - name.length / 20 : name.includes(q) ? 70 - name.length / 20 : q.includes(name) ? 50 : 0 }))
        .filter((x) => x.score > 0).sort((x, y) => y.score - x.score);
      if (!scored.length) return nope(`No icon matched “${a.query}”. Try a shorter noun like "star" or "arrow".`);
      const icon = icons[scored[0].name];
      const src = iconToDataUrl(icon.svg, a.color, a.strokeWidth, 512);
      const size = fx(a.size, W(), 0.06);
      const layer = createImage(src, {
        name: `Icon / ${scored[0].name}`, x: fx(a.x, W()), y: fx(a.y, H()), w: size, h: size, opacity: a.opacity,
        media: { src, fit: 'contain' },
      });
      return done(`Inserted “${scored[0].name}” icon at ${size}px`, commit([{ op: 'add_layers', layers: [layer] }], 'Added icon'), { data: { id: layer.id, alternatives: scored.slice(1, 6).map((s) => s.name) } });
    },
  });

  const addBackdropTool = tool({
    description: 'Add a procedural atmosphere layer — mesh gradient, grain, waves, orb, grid, blob, spotlight or duotone — rendered as real geometry/SVG so it scales and animates. Great as a full-bleed base behind a composition.',
    parameters: z.object({
      kind: z.enum(['mesh', 'grain', 'waves', 'orb', 'grid', 'blob', 'spotlight', 'duotone']).default('mesh'),
      colors: z.array(COLOR).min(2).max(4).optional(),
      seed: z.number().int().default(9),
      opacity: z.number().min(0).max(1).default(1),
      blendMode: z.enum(['normal', 'screen', 'overlay', 'soft-light', 'multiply', 'plus-lighter']).default('normal'),
      animate: z.boolean().default(true),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const colors = a.colors ?? pickPalette(state.project.name);
      const src = makeBackdrop(a.kind, colors, a.seed);
      const layer = createImage(src, {
        name: `Backdrop / ${a.kind}`, x: 0, y: 0, w: W(), h: H(), opacity: a.opacity, blendMode: a.blendMode as BlendMode,
        media: { src, fit: 'cover' },
        keyframes: a.animate ? {
          scaleX: [kf(0, 1), kf(state.project.duration, 1.08, { type: 'linear' })],
          scaleY: [kf(0, 1), kf(state.project.duration, 1.08, { type: 'linear' })],
          rotation: [kf(0, -1), kf(state.project.duration, 1, { type: 'linear' })],
        } : {},
      });
      return done(`Added a ${a.kind} backdrop behind the composition`, commit([{ op: 'add_layers', layers: [layer], index: 0 }], 'Added backdrop'), { data: { id: layer.id } });
    },
  });

  const addCaptionsTool = tool({
    description: 'Generate timed caption layers from a script. Each caption appears on its own time slice with clean styling; pass the spoken text (not the on-screen headline).',
    parameters: z.object({
      text: z.string().min(2).max(4000),
      start: z.number().min(0).default(0),
      style: z.enum(['bar', 'minimal', 'karaoke', 'bold-pop']).default('bar'),
      color: COLOR.default('#ffffff'),
      background: COLOR.optional(),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const layers = captionLayers(a.text, state.project);
      if (!layers.length) return nope('Could not split that text into captions.');
      const styled = layers.map((l) => {
        const startTime = l.startTime + a.start;
        return {
          ...l, startTime, endTime: Math.min(l.endTime + a.start, state.project.duration),
          text: l.text ? {
            ...l.text, color: a.color,
            fontFamily: a.style === 'bold-pop' ? 'Anton' : 'Inter',
            fontWeight: a.style === 'bold-pop' ? 800 : 600,
            fontSize: a.style === 'bold-pop' ? Math.round(W() * 0.045) : Math.round(W() * 0.028),
            uppercase: a.style === 'bold-pop',
          } : l.text,
          fill: a.background ?? (a.style === 'bar' ? 'rgba(9,9,14,0.62)' : 'transparent'),
          radius: a.style === 'bar' ? Math.round(W() * 0.012) : 0,
        };
      }).filter((l) => l.startTime < state.project.duration);
      return done(`Added ${styled.length} styled captions (${a.style})`, commit([{ op: 'add_layers', layers: styled }], 'Added captions'), { data: { count: styled.length, ids: styled.map((s) => s.id) } });
    },
  });

  /* ═══════════════════════════════ audio ═══════════════════════════════════ */

  const addMusicTool = tool({
    description: 'Add a royalty-free procedural soundtrack (synthesized in the browser, fully real). Moods: ambient, electronic, cinematic, lo-fi, synthwave, minimal. Also use for SFX: whoosh, pop, riser, impact, click, shimmer.',
    parameters: z.object({
      track: z.string().describe('Track id or mood/keyword, e.g. "mus-pulse", "cinematic", "whoosh"'),
      volume: z.number().min(0).max(1).default(0.55),
      fadeIn: z.number().min(0).max(8).default(1),
      fadeOut: z.number().min(0).max(8).default(1.2),
      start: z.number().min(0).default(0),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const q = a.track.toLowerCase();
      const track = MUSIC_TRACKS.find((t) => t.id === q || t.name.toLowerCase() === q || t.mood.toLowerCase() === q)
        ?? MUSIC_TRACKS.find((t) => `${t.id} ${t.name} ${t.mood}`.toLowerCase().includes(q));
      if (!track) return nope(`No track matched “${a.track}”. Options: ${MUSIC_TRACKS.slice(0, 10).map((t) => `${t.id} (${t.mood})`).join(', ')}…`);
      const layer = createLayer({
        type: 'audio', name: `${track.name} · ${track.kind === 'sfx' ? 'SFX' : 'Music'}`,
        x: 0, y: 0, w: W(), h: 72, fill: 'transparent',
        startTime: ts(a.start), endTime: ts(a.start + (track.kind === 'sfx' ? track.duration : state.project.duration)),
        media: { src: `synth:${track.id}`, fit: 'cover', volume: a.volume, fadeIn: a.fadeIn, fadeOut: a.fadeOut, duration: track.duration, bpm: track.bpm } as Layer['media'],
      });
      return done(`Added “${track.name}” (${track.mood}${track.bpm ? `, ${track.bpm} BPM` : ''})`, commit([{ op: 'add_layers', layers: [layer] }], 'Added music'), { data: { id: layer.id, track: track.id } });
    },
  });

  /* ═══════════════════════════════ editing ═════════════════════════════════ */

  const setLayerTool = tool({
    description: 'Patch properties of an existing layer — position, size, rotation, opacity, fill, radius, blend mode, text content, font, color, timing. Reference layers by id or (partial) name. Only send what changes.',
    parameters: z.object({
      layer: z.string().min(1),
      x: z.number().optional(), y: z.number().optional(), w: z.number().optional(), h: z.number().optional(),
      rotation: z.number().optional(), scaleX: z.number().min(0.01).max(20).optional(), scaleY: z.number().min(0.01).max(20).optional(),
      opacity: z.number().min(0).max(1).optional(),
      fill: COLOR.optional(), stroke: COLOR.optional(), strokeWidth: z.number().min(0).max(60).optional(),
      radius: z.number().min(0).max(900).optional(), visible: z.boolean().optional(), name: z.string().max(60).optional(),
      blendMode: z.string().optional(),
      text: z.string().max(800).optional(), fontSize: z.number().min(4).max(900).optional(),
      fontFamily: z.string().optional(), fontWeight: z.number().int().min(100).max(900).optional(),
      color: COLOR.optional(), align: z.enum(['left', 'center', 'right']).optional(),
      letterSpacing: z.number().min(-20).max(80).optional(), lineHeight: z.number().min(0.6).max(3).optional(),
      gradientColors: z.array(COLOR).min(2).max(6).optional(), gradientAngle: z.number().default(135),
      start: z.number().min(0).optional(), end: z.number().min(0).optional(),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer) return nope(`No layer matched “${a.layer}”. Open layers: ${state.project.layers.slice(0, 16).map(layerLine).join(' · ')}`);
      const patch: Partial<Layer> = {};
      if (a.x !== undefined) patch.x = fx(a.x, W());
      if (a.y !== undefined) patch.y = fx(a.y, H());
      if (a.w !== undefined) patch.w = fx(a.w, W(), 0.3);
      if (a.h !== undefined) patch.h = fx(a.h, H(), 0.2);
      if (a.rotation !== undefined) patch.rotation = a.rotation;
      if (a.scaleX !== undefined) patch.scaleX = a.scaleX;
      if (a.scaleY !== undefined) patch.scaleY = a.scaleY;
      if (a.opacity !== undefined) patch.opacity = a.opacity;
      if (a.fill !== undefined) patch.fill = a.fill;
      if (a.stroke !== undefined) patch.stroke = a.stroke;
      if (a.strokeWidth !== undefined) patch.strokeWidth = a.strokeWidth;
      if (a.radius !== undefined) patch.radius = a.radius;
      if (a.visible !== undefined) patch.visible = a.visible;
      if (a.name !== undefined) patch.name = a.name;
      if (a.blendMode !== undefined) patch.blendMode = a.blendMode as BlendMode;
      if (a.start !== undefined) patch.startTime = ts(a.start);
      if (a.end !== undefined) patch.endTime = ts(a.end);
      if (a.gradientColors) patch.fillGradient = gradient(a.gradientColors, a.gradientAngle);
      const text: Record<string, unknown> = {};
      if (a.text !== undefined) text.content = a.text;
      if (a.fontSize !== undefined) text.fontSize = Math.round(a.fontSize * (W() / 1080));
      if (a.fontFamily !== undefined) text.fontFamily = a.fontFamily;
      if (a.fontWeight !== undefined) text.fontWeight = a.fontWeight;
      if (a.color !== undefined) text.color = a.color;
      if (a.align !== undefined) text.align = a.align;
      if (a.letterSpacing !== undefined) text.letterSpacing = a.letterSpacing;
      if (a.lineHeight !== undefined) text.lineHeight = a.lineHeight;
      if (a.gradientColors) text.gradient = gradient(a.gradientColors, a.gradientAngle);
      if (Object.keys(text).length) patch.text = { ...(layer.text ?? {}), ...text } as Layer['text'];
      if (!Object.keys(patch).length) return nope('No properties supplied.');
      return done(`Updated ${layer.name}: ${Object.keys(patch).join(', ')}`, commit([{ op: 'update_layer', id: layer.id, patch }], 'Updated layer'), { data: { id: layer.id } });
    },
  });

  const duplicateTool = tool({
    description: 'Duplicate one or more layers with a small offset. Returns the new ids so you can animate the copies individually.',
    parameters: z.object({ layers: z.array(z.string()).min(1).max(24), offsetX: z.number().default(0.02), offsetY: z.number().default(0.02), count: z.number().int().min(1).max(12).default(1) }),
    execute: async (a): Promise<ToolOutput> => {
      const found = refs(a.layers);
      if (!found.length) return nope('No matching layers to duplicate.');
      const clones: Layer[] = [];
      for (let i = 0; i < a.count; i++) {
        for (const l of found) {
          clones.push({ ...structuredClone(l), id: uid('ly'), name: `${l.name} ${i + 2}`, x: l.x + fx(a.offsetX, W(), 0.02) * (i + 1), y: l.y + fx(a.offsetY, H(), 0.02) * (i + 1) });
        }
      }
      return done(`Duplicated ${found.length} layer${found.length === 1 ? '' : 's'} ×${a.count}`, commit([{ op: 'add_layers', layers: clones }], 'Duplicated layers'), { data: { ids: clones.map((c) => c.id) } });
    },
  });

  const deleteTool = tool({
    description: 'Delete layers by id or partial name. Groups take their children with them.',
    parameters: z.object({ layers: z.array(z.string()).min(1).max(40) }),
    execute: async (a): Promise<ToolOutput> => {
      const found = refs(a.layers);
      if (!found.length) return nope(`Nothing matched: ${a.layers.join(', ')}`);
      return done(`Deleted ${found.map((l) => l.name).join(', ')}`, commit([{ op: 'delete_layers', ids: found.map((l) => l.id) }], 'Deleted layers'));
    },
  });

  const reorderTool = tool({
    description: 'Move a layer in the stack — index 0 is topmost, or use position front/back/forward/backward.',
    parameters: z.object({ layer: z.string().min(1), index: z.number().int().min(0).optional(), position: z.enum(['front', 'back', 'forward', 'backward']).optional() }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer) return nope(`No layer matched “${a.layer}”.`);
      const current = state.project.layers.findIndex((l) => l.id === layer.id);
      let toIndex = a.index ?? current;
      if (a.position === 'front') toIndex = 0;
      if (a.position === 'back') toIndex = state.project.layers.length - 1;
      if (a.position === 'forward') toIndex = Math.max(0, current - 1);
      if (a.position === 'backward') toIndex = Math.min(state.project.layers.length - 1, current + 1);
      return done(`Moved ${layer.name} to index ${toIndex}`, commit([{ op: 'reorder_layer', id: layer.id, toIndex }], 'Reordered layer'));
    },
  });

  const groupTool = tool({
    description: 'Group layers so they transform and animate together. Supports nesting.',
    parameters: z.object({ layers: z.array(z.string()).min(2).max(40), name: z.string().max(60).default('Group') }),
    execute: async (a): Promise<ToolOutput> => {
      const found = refs(a.layers);
      if (found.length < 2) return nope('Grouping needs at least two valid layers.');
      const id = uid('grp');
      return done(`Grouped ${found.length} layers as “${a.name}”`, commit([{ op: 'group_layers', ids: found.map((l) => l.id), name: a.name, id }], 'Grouped layers'), { data: { id } });
    },
  });

  const ungroupTool = tool({
    description: 'Ungroup a group back to the root.',
    parameters: z.object({ layer: z.string().min(1) }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer || layer.type !== 'group') return nope('That layer is not a group.');
      return done(`Ungrouped ${layer.name}`, commit([{ op: 'ungroup_layer', id: layer.id }], 'Ungrouped'));
    },
  });

  const alignTool = tool({
    description: 'Align layers to the canvas (with a margin) or to each other.',
    parameters: z.object({
      layers: z.array(z.string()).min(1).max(40),
      mode: z.enum(['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom']),
      to: z.enum(['canvas', 'selection']).default('canvas'),
      margin: z.number().min(0).max(0.3).default(0.06),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const found = refs(a.layers);
      if (!found.length) return nope('No layers to align.');
      if (a.to === 'selection') {
        return done(`Aligned ${found.length} layers ${a.mode}`, commit([{ op: 'align', ids: found.map((l) => l.id), mode: a.mode }], 'Aligned'));
      }
      const m = fx(a.margin, W(), 0.06);
      const ops: Op[] = found.map((l): Op => {
        let x = l.x, y = l.y;
        if (a.mode === 'left') x = m;
        if (a.mode === 'right') x = W() - l.w - m;
        if (a.mode === 'hcenter') x = Math.round((W() - l.w) / 2);
        if (a.mode === 'top') y = m;
        if (a.mode === 'bottom') y = H() - l.h - m;
        if (a.mode === 'vcenter') y = Math.round((H() - l.h) / 2);
        return { op: 'update_layer', id: l.id, patch: { x, y } };
      });
      return done(`Aligned ${found.length} layer${found.length === 1 ? '' : 's'} ${a.mode} on canvas`, commit(ops, 'Aligned'));
    },
  });

  const distributeTool = tool({
    description: 'Distribute layers evenly along the horizontal or vertical axis.',
    parameters: z.object({ layers: z.array(z.string()).min(2).max(60), axis: z.enum(['horizontal', 'vertical']) }),
    execute: async (a): Promise<ToolOutput> => {
      const found = refs(a.layers);
      if (found.length < 2) return nope('Need at least two layers.');
      return done(`Distributed ${found.length} layers ${a.axis}`, commit([{ op: 'distribute', ids: found.map((l) => l.id), axis: a.axis }], 'Distributed'));
    },
  });

  const parentTool = tool({
    description: 'Parent a layer to a controller/null layer so it inherits its transform and keyframes.',
    parameters: z.object({ layer: z.string().min(1), parent: z.string().min(1) }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      const parent = find(a.parent);
      if (!layer || !parent) return nope('Layer or parent not found.');
      if (layer.id === parent.id) return nope('A layer cannot parent itself.');
      return done(`${layer.name} now follows ${parent.name}`, commit([{ op: 'set_parent', id: layer.id, parentId: parent.id }], 'Parented'));
    },
  });

  /* ═══════════════════════════════ motion ══════════════════════════════════ */

  const ANIM_PROPS = ['x', 'y', 'w', 'h', 'rotation', 'scaleX', 'scaleY', 'opacity', 'blur', 'hue', 'saturate', 'radius', 'fontSize', 'letterSpacing', 'volume'] as const;

  const addKeyframeTool = tool({
    description: 'Add a keyframe to any animatable property. x/y/w/h are canvas fractions, rotation is degrees, opacity/scale/volume are 0–1 or multipliers, blur/hue/saturate are effect values. Two or more keyframes animate the property.',
    parameters: z.object({
      layer: z.string().min(1),
      property: z.enum(ANIM_PROPS),
      time: z.number().min(0).max(600),
      value: z.number(),
      easing: z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut', 'expo', 'spring', 'bounce', 'elastic']).default('easeInOut'),
      bezier: z.array(z.number()).length(4).optional(),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer) return nope(`No layer matched “${a.layer}”.`);
      const value = a.property === 'x' || a.property === 'w' ? fx(a.value, W()) : a.property === 'y' || a.property === 'h' ? fx(a.value, H()) : a.value;
      const ops = commit([{ op: 'add_keyframe', layerId: layer.id, prop: a.property as AnimatableProp, time: ts(a.time), value, easing: ease(a.easing, a.bezier) }], `Keyframed ${a.property}`);
      return done(`Keyframed ${layer.name}.${a.property} = ${Math.round(value * 100) / 100} @ ${a.time}s (${a.easing})`, ops);
    },
  });

  const setKeyframesTool = tool({
    description: 'Replace a property’s keyframes with an explicit multi-stop curve — precise choreography, holds, speed ramps. Times in seconds; values in fractions for x/y/w/h.',
    parameters: z.object({
      layer: z.string().min(1),
      property: z.enum(ANIM_PROPS),
      keyframes: z.array(z.object({ time: z.number().min(0), value: z.number(), easing: z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut', 'expo', 'spring', 'bounce', 'elastic']).default('easeInOut') })).min(1).max(40),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer) return nope(`No layer matched “${a.layer}”.`);
      const frames = a.keyframes
        .map((k) => kf(k.time, a.property === 'x' || a.property === 'w' ? fx(k.value, W()) : a.property === 'y' || a.property === 'h' ? fx(k.value, H()) : k.value, ease(k.easing)))
        .sort((x, y) => x.time - y.time);
      return done(`Set ${frames.length} keyframes on ${layer.name}.${a.property} (${frames[0].time}s → ${frames[frames.length - 1].time}s)`, commit([{ op: 'set_keyframes', layerId: layer.id, prop: a.property as AnimatableProp, keyframes: frames }], 'Set keyframes'));
    },
  });

  const presetTool = tool({
    description: `Apply a crafted motion preset: ${ANIMATION_PRESETS.map((p) => p.id).join(', ')}. Writes real keyframes and text animators. Use enter presets at the layer start and stagger groups 0.05–0.12s.`,
    parameters: z.object({
      layers: z.array(z.string()).min(1).max(40),
      preset: z.string().min(2),
      duration: z.number().min(0.1).max(12).optional(),
      stagger: z.number().min(0).max(1.2).default(0),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const preset = ANIMATION_PRESETS.find((p) => p.id === a.preset.toLowerCase()) ?? ANIMATION_PRESETS.find((p) => p.name.toLowerCase().replace(/\s+/g, '-') === a.preset.toLowerCase());
      if (!preset) return nope(`Unknown preset “${a.preset}”. Options: ${ANIMATION_PRESETS.map((p) => p.id).join(', ')}.`);
      const found = refs(a.layers);
      if (!found.length) return nope('No matching layers.');
      const ops: Op[] = [];
      found.forEach((layer, i) => {
        const applied = applyPresetToLayer(layer, preset.id, a.duration ?? Math.min(1.4, state.project.duration));
        const shift = i * a.stagger;
        const keyframes = Object.fromEntries(Object.entries(applied.keyframes ?? {}).map(([prop, frames]) => [prop, (frames ?? []).map((f) => ({ ...f, time: ts(f.time + shift) }))]));
        ops.push({ op: 'update_layer', id: layer.id, patch: { keyframes } });
        if (applied.text?.animator) ops.push({ op: 'update_layer', id: layer.id, patch: { text: { ...layer.text!, animator: applied.text.animator } } });
      });
      return done(`Applied “${preset.name}” to ${found.length} layer${found.length === 1 ? '' : 's'}${a.stagger ? ` · ${a.stagger}s stagger` : ''}`, commit(ops, `Preset ${preset.id}`));
    },
  });

  const effectTool = tool({
    description: 'Add an effect: blur, glow, dropShadow, brightness, contrast, saturate, hue, grayscale, sepia, invert, chromatic, noise, grain, vignette, lightSweep, pixelate, bloom, displacement, scanlines. Amount 0–100.',
    parameters: z.object({
      layer: z.string().min(1),
      effect: z.enum(['blur', 'glow', 'shadow', 'brightness', 'contrast', 'saturate', 'hue', 'grayscale', 'sepia', 'invert', 'chromatic', 'noise', 'grain', 'vignette', 'lightSweep', 'pixelate', 'bloom', 'dropShadow', 'displacement', 'scanlines']),
      amount: z.number().min(0).max(100).default(32),
      color: COLOR.optional(), radius: z.number().min(0).max(300).optional(), angle: z.number().optional(),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer) return nope(`No layer matched “${a.layer}”.`);
      const effect = newEffect(a.effect, a.amount, { color: a.color, blur: a.radius });
      return done(`Added ${a.effect} ${a.amount} to ${layer.name}`, commit([{ op: 'add_effect', layerId: layer.id, effect }], 'Added effect'), { data: { effectId: effect.id } });
    },
  });

  const removeEffectTool = tool({
    description: 'Remove an effect from a layer, by effect id or type name.',
    parameters: z.object({ layer: z.string().min(1), effect: z.string().min(2) }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer) return nope(`No layer matched “${a.layer}”.`);
      const match = layer.effects.find((e) => e.id === a.effect) ?? layer.effects.find((e) => e.type.toLowerCase() === a.effect.toLowerCase());
      if (!match) return nope(`${layer.name} has no “${a.effect}” effect. Present: ${layer.effects.map((e) => e.type).join(', ') || 'none'}`);
      return done(`Removed ${match.type} from ${layer.name}`, commit([{ op: 'remove_effect', layerId: layer.id, effectId: match.id }], 'Removed effect'));
    },
  });

  const maskTool = tool({
    description: 'Mask a layer with a rectangle, ellipse or linear gradient. Feather softens the edge; invert punches a hole.',
    parameters: z.object({
      layer: z.string().min(1),
      shape: z.enum(['rect', 'ellipse', 'linear']).default('rect'),
      x: z.number().default(0.1), y: z.number().default(0.1), w: z.number().default(0.8), h: z.number().default(0.8),
      feather: z.number().min(0).max(240).default(20),
      invert: z.boolean().default(false), angle: z.number().default(0),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer) return nope(`No layer matched “${a.layer}”.`);
      void fx; void W; void H;
      const type = a.shape === 'rect' ? 'rect' : a.shape === 'ellipse' ? 'ellipse' : 'gradient';
      const ops = commit([{ op: 'set_mask', layerId: layer.id, mask: { type, feather: a.feather, inverted: a.invert, angle: a.angle } }], 'Applied mask');
      return done(`Applied a ${a.shape} mask to ${layer.name} (feather ${a.feather})`, ops);
    },
  });

  const transitionTool = tool({
    description: 'Create a transition from layer A into layer B at a given time: fade, slide, scale, blur or wipe.',
    parameters: z.object({
      from: z.string().min(1), to: z.string().min(1), at: z.number().min(0),
      duration: z.number().min(0.1).max(6).default(0.6),
      kind: z.enum(['fade', 'slide', 'scale', 'blur', 'wipe']).default('fade'),
      direction: z.enum(['left', 'right', 'up', 'down']).default('left'),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const from = find(a.from), to = find(a.to);
      if (!from || !to) return nope('Both layers must exist for a transition.');
      const t0 = ts(a.at), t1 = ts(a.at + a.duration);
      const ops: Op[] = [{ op: 'update_layer', id: to.id, patch: { startTime: Math.min(to.startTime, t0), endTime: state.project.duration } }];
      const curve = (base: number, toValue: number) => [kf(t0, base, { type: 'easeInOut' }), kf(t1, toValue, { type: 'easeInOut' })];
      if (a.kind === 'fade' || a.kind === 'scale' || a.kind === 'blur' || a.kind === 'wipe') {
        ops.push({ op: 'set_keyframes', layerId: from.id, prop: 'opacity', keyframes: curve(1, 0) });
        ops.push({ op: 'set_keyframes', layerId: to.id, prop: 'opacity', keyframes: curve(0, 1) });
      }
      if (a.kind === 'slide') {
        const dx = a.direction === 'left' ? -W() * 0.35 : a.direction === 'right' ? W() * 0.35 : 0;
        const dy = a.direction === 'up' ? -H() * 0.35 : a.direction === 'down' ? H() * 0.35 : 0;
        ops.push({ op: 'set_keyframes', layerId: from.id, prop: 'x', keyframes: curve(from.x, from.x + dx) });
        ops.push({ op: 'set_keyframes', layerId: from.id, prop: 'y', keyframes: curve(from.y, from.y + dy) });
        ops.push({ op: 'set_keyframes', layerId: to.id, prop: 'opacity', keyframes: curve(0, 1) });
      }
      if (a.kind === 'scale') {
        ops.push({ op: 'set_keyframes', layerId: from.id, prop: 'scaleX', keyframes: curve(1, 1.18) });
        ops.push({ op: 'set_keyframes', layerId: from.id, prop: 'scaleY', keyframes: curve(1, 1.18) });
      }
      if (a.kind === 'blur') ops.push({ op: 'set_keyframes', layerId: from.id, prop: 'blur', keyframes: curve(0, 28) });
      if (a.kind === 'wipe') ops.push({ op: 'set_mask', layerId: to.id, mask: { type: 'gradient', feather: 120, inverted: false, angle: a.direction === 'left' ? 0 : a.direction === 'right' ? 180 : a.direction === 'up' ? 90 : 270 } });
      return done(`${a.kind} transition ${from.name} → ${to.name} at ${t0.toFixed(2)}s`, commit(ops, 'Added transition'));
    },
  });

  const timingTool = tool({
    description: 'Composition settings: duration, fps, background color, background gradient, name. Use it to extend the timeline before adding a long scene.',
    parameters: z.object({
      duration: z.number().min(0.5).max(600).optional(),
      fps: z.number().int().min(12).max(120).optional(),
      background: COLOR.optional(),
      gradientColors: z.array(COLOR).min(2).max(4).optional(),
      gradientAngle: z.number().default(135),
      name: z.string().max(120).optional(),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const patch: Partial<Omit<Project, 'layers'>> = {};
      if (a.duration) patch.duration = a.duration;
      if (a.fps) patch.fps = a.fps;
      if (a.background) patch.background = a.background;
      if (a.gradientColors) patch.backgroundGradient = gradient(a.gradientColors, a.gradientAngle);
      if (a.name) patch.name = a.name;
      if (!Object.keys(patch).length) return nope('Nothing to change.');
      return done(`Composition updated: ${patch.duration ?? state.project.duration}s · ${state.project.fps}fps · ${state.project.width}×${state.project.height}`, commit([{ op: 'set_project', patch }], 'Updated composition'));
    },
  });

  const trimTool = tool({
    description: 'Trim a layer on the timeline, set playback speed, or loop it.',
    parameters: z.object({
      layer: z.string().min(1), start: z.number().min(0).optional(), end: z.number().min(0).optional(),
      speed: z.number().min(0.1).max(8).optional(), loop: z.boolean().optional(),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer) return nope(`No layer matched “${a.layer}”.`);
      const patch: Partial<Layer> = {};
      if (a.start !== undefined) patch.startTime = ts(a.start);
      if (a.end !== undefined) patch.endTime = ts(a.end);
      if (a.speed !== undefined && layer.media) patch.media = { ...layer.media, playbackRate: a.speed };
      if (a.loop !== undefined) patch.meta = { ...(layer.meta ?? {}), loop: a.loop };
      return done(`Trimmed ${layer.name} to ${(a.start ?? layer.startTime).toFixed(2)}–${(a.end ?? layer.endTime).toFixed(2)}s${a.speed ? ` @${a.speed}×` : ''}`, commit([{ op: 'update_layer', id: layer.id, patch }], 'Trimmed layer'));
    },
  });

  const particlesTool = tool({
    description: 'Turn a shape or image into a particle emitter (confetti, dust, sparks, snow) — simulated deterministically in the renderer, so it exports correctly.',
    parameters: z.object({
      layer: z.string().min(1), count: z.number().int().min(2).max(300).default(60),
      speed: z.number().min(0).max(900).default(180), size: z.number().min(0.4).max(80).default(8),
      gravity: z.number().min(-800).max(1200).default(220), spread: z.number().min(1).max(360).default(120),
      lifetime: z.number().min(0.2).max(20).default(2.4), color: COLOR.optional(),
      turbulence: z.number().min(0).max(1).default(0.15), seed: z.number().int().default(11),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer) return nope(`No layer matched “${a.layer}”.`);
      const ops = commit([{ op: 'update_layer', id: layer.id, patch: { particles: { count: a.count, speed: a.speed, size: a.size, gravity: a.gravity, spread: a.spread, color: a.color ?? layer.fill, shape: a.turbulence > 0.5 ? 'star' : 'circle', seed: a.seed } } }], 'Added particles');
      return done(`${a.count} particles emitting from ${layer.name}`, ops);
    },
  });

  const physicsTool = tool({
    description: 'Bake spring / bounce / settle overshoot into a transform, giving physicality without a plugin.',
    parameters: z.object({
      layer: z.string().min(1), kind: z.enum(['spring', 'bounce', 'settle', 'wobble']).default('spring'),
      at: z.number().min(0).default(0), amplitude: z.number().min(0.01).max(0.6).default(0.1),
      property: z.enum(['y', 'x', 'scale', 'rotation']).default('y'),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer) return nope(`No layer matched “${a.layer}”.`);
      const t = ts(a.at);
      const seq = a.kind === 'spring' ? [0, 1, -0.35, 0.12, 0] : a.kind === 'bounce' ? [0, 1, 0, 0.42, 0] : a.kind === 'wobble' ? [0, 1, -0.55, 0.24, 0] : [0, 1, 0.14, 0];
      const times = [0, 0.18, 0.42, 0.68, 0.96].slice(0, seq.length).map((p) => ts(t + p * 0.9));
      const cur = (prop: 'y' | 'x' | 'scale' | 'rotation') => prop === 'y' ? layer.y : prop === 'x' ? layer.x : prop === 'rotation' ? layer.rotation : 1;
      const base = cur(a.property);
      const unit = a.property === 'y' ? H() : a.property === 'x' ? W() : 1;
      const frames = seq.map((v, i) => kf(times[i], a.property === 'scale' ? base + v * a.amplitude : base + v * a.amplitude * unit, { type: a.kind === 'bounce' ? 'bounce' : 'spring' }));
      const props: AnimatableProp[] = a.property === 'scale' ? ['scaleX', 'scaleY'] : [a.property as AnimatableProp];
      const ops = props.map((prop): Op => ({ op: 'set_keyframes', layerId: layer.id, prop, keyframes: frames }));
      return done(`Baked ${a.kind} physics into ${layer.name}.${a.property}`, commit(ops, `Physics ${a.kind}`));
    },
  });

  const animateImageTool = tool({
    description: 'Give an image cinematic motion: kenBurns (slow push), parallax (depth illusion with copies), reveal (masked slide), kinetic (snappy beat-driven), 2.5d (subtle rotate/scale).',
    parameters: z.object({ layer: z.string().min(1), style: z.enum(['kenBurns', 'parallax', 'reveal', 'kinetic', '2.5d']).default('kenBurns'), duration: z.number().min(0.5).max(60).optional() }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer) return nope(`No layer matched “${a.layer}”.`);
      const generated = imageMotionLayers(layer, a.style, a.duration ?? state.project.duration);
      const ops: Op[] = generated.filter((l) => l.id !== layer.id).map((l) => ({ op: 'add_layers', layers: [l] }));
      const updated = generated.find((l) => l.id === layer.id);
      if (updated) ops.unshift({ op: 'update_layer', id: layer.id, patch: { keyframes: updated.keyframes, effects: updated.effects } });
      return done(`Applied ${a.style} motion to ${layer.name}`, commit(ops, `Image motion ${a.style}`));
    },
  });

  /* ═══════════════════════════ real AI media ══════════════════════════════ */

  const generateImageTool = tool({
    description: 'Generate a real image with the configured image model (gpt-image-1 / dall-e-3 / imagen). Use it for hero photography, textures, product shots and abstract art the brief needs. External stock is unavailable unless search_stock reports configured.',
    parameters: z.object({
      prompt: z.string().min(6).max(1200),
      size: z.enum(['1024x1024', '1536x1024', '1024x1536']).default('1536x1024'),
      quality: z.enum(['low', 'medium', 'high']).default('medium'),
      place: z.enum(['full', 'background', 'inset', 'none']).default('full'),
      x: z.number().default(0), y: z.number().default(0), w: z.number().default(1), h: z.number().default(1),
      fit: z.enum(['cover', 'contain']).default('cover'),
      radius: z.number().min(0).max(600).default(0),
      opacity: z.number().min(0).max(1).default(1),
      name: z.string().max(60).optional(),
    }),
    execute: async (a): Promise<ToolOutput> => {
      if (!deps.generateImage) return nope('Image generation is not available: no image-capable provider is connected. Connect OpenAI or Google in Settings → AI, or use shapes, gradients and typography instead.');
      try {
        const img = await deps.generateImage({ prompt: a.prompt, size: a.size, quality: a.quality });
        const saved = await saveGenerated(img.dataUrl, 'png');
        const place = a.place === 'none' ? null : a.place === 'background' ? { x: 0, y: 0, w: 1, h: 1 } : { x: a.x, y: a.y, w: a.w, h: a.h };
        let ops: Op[] = [];
        if (place) {
          const layer = createImage(saved.url, {
            name: a.name ?? `Generated · ${a.prompt.slice(0, 24)}`,
            x: fx(place.x, W()), y: fx(place.y, H()), w: fx(place.w, W(), 1), h: fx(place.h, H(), 1),
            radius: a.radius, opacity: a.opacity,
            media: { src: saved.url, fit: a.fit },
          });
          ops = commit([{ op: 'add_layers', layers: [layer], index: a.place === 'background' ? 0 : undefined }], 'Added generated image');
        }
        return done(`Generated a ${a.size} image with ${img.model} (${Math.round(saved.bytes / 1024)} KB)`, ops, { data: { url: saved.url, model: img.model, revisedPrompt: img.revisedPrompt } });
      } catch (e) {
        return nope(`Image generation failed: ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    },
  });

  const voiceoverTool = tool({
    description: 'Generate a real voiceover with the configured speech provider and place it on the timeline. Optionally burn matching captions. Write narration for the ear: short sentences, numbers spelled out.',
    parameters: z.object({
      text: z.string().min(2).max(2000),
      voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).default('nova'),
      start: z.number().min(0).default(0),
      volume: z.number().min(0).max(1).default(0.9),
      captions: z.boolean().default(false),
      captionStyle: z.enum(['bar', 'minimal', 'karaoke', 'bold-pop']).default('bar'),
    }),
    execute: async (a): Promise<ToolOutput> => {
      if (!deps.generateSpeech) return nope('Speech generation is not available: connect OpenAI in Settings → AI to enable voiceover. You can still write the script into a text layer as a placeholder.');
      try {
        const speech = await deps.generateSpeech({ text: a.text, voice: a.voice });
        const saved = await saveGenerated(speech.dataUrl, 'mp3');
        const est = Math.max(1, a.text.split(/\s+/).length / 2.6);
        const audio = createLayer({
          type: 'audio', name: `Voiceover · ${a.voice}`,
          x: 0, y: 0, w: W(), h: 72, fill: 'transparent',
          startTime: ts(a.start), endTime: ts(a.start + est),
          media: { src: saved.url, fit: 'cover', volume: a.volume, duration: est, fadeIn: 0.15, fadeOut: 0.3 } as Layer['media'],
        });
        const ops: Op[] = [{ op: 'add_layers', layers: [audio] }];
        if (a.captions) {
          const caps = captionLayers(a.text, state.project)
            .filter((l) => l.startTime + a.start < state.project.duration)
            .map((l) => ({ ...l, startTime: ts(l.startTime + a.start), endTime: ts(l.endTime + a.start), fill: a.captionStyle === 'minimal' ? 'transparent' : 'rgba(9,9,14,0.6)' }));
          if (caps.length) ops.push({ op: 'add_layers', layers: caps });
        }
        return done(`Voiceover generated (${speech.model}, ~${est.toFixed(1)}s)${a.captions ? ' with captions' : ''}`, commit(ops, 'Added voiceover'), { data: { url: saved.url, model: speech.model, seconds: est } });
      } catch (e) {
        return nope(`Voiceover failed: ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    },
  });

  const addVideoTool = tool({
    description: 'Add a video layer from an mp4/webm URL. Set startAt to skip the head of the clip and speed for slow motion or time-lapse.',
    parameters: z.object({
      src: z.string().min(4),
      start: z.number().min(0).default(0), end: z.number().min(0).optional(),
      startAt: z.number().min(0).default(0), speed: z.number().min(0.1).max(8).default(1),
      muted: z.boolean().default(true), fit: z.enum(['cover', 'contain']).default('cover'),
      opacity: z.number().min(0).max(1).default(1), radius: z.number().min(0).max(600).default(0),
      name: z.string().max(60).optional(),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = createLayer({
        type: 'video', name: a.name ?? 'Video',
        x: 0, y: 0, w: W(), h: H(), fill: 'transparent', opacity: a.opacity, radius: a.radius,
        startTime: ts(a.start), endTime: ts(a.end ?? state.project.duration),
        media: { src: a.src, fit: a.fit, trimStart: a.startAt, playbackRate: a.speed, muted: a.muted } as Layer['media'],
      });
      return done(`Added video (${a.speed}×, starts at ${a.startAt}s of the source)`, commit([{ op: 'add_layers', layers: [layer] }], 'Added video'), { data: { id: layer.id } });
    },
  });

  /* ═══════════════════════════ vision & analysis ══════════════════════════ */

  const analyzeImageTool = tool({
    description: 'Run real vision analysis on an image layer — describe composition, read text, judge style, check contrast. Requires a vision-capable provider.',
    parameters: z.object({
      layer: z.string().min(1),
      question: z.string().min(4).max(400).default('Describe the composition, palette, typography and mood in precise art-direction terms.'),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer || !layer.media?.src) return nope('That layer has no image to analyze.');
      if (!/^(https?:\/\/|data:image\/|\/)/.test(layer.media.src)) return nope('Only http(s), data: and /api/assets images can be analyzed.');
      if (!deps.vision) return nope('No vision-capable provider is connected. Connect OpenAI, Anthropic or Google in Settings → AI.');
      try {
        const answer = await deps.vision({ prompt: a.question, image: layer.media.src });
        return { ok: true, summary: `Analyzed ${layer.name}`, data: { analysis: answer } };
      } catch (e) {
        return nope(`Vision analysis failed: ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    },
  });

  const extractColorsTool = tool({
    description: 'Extract a disciplined color palette from an image layer (real vision), optionally applying it to the composition background and accents.',
    parameters: z.object({ layer: z.string().min(1), apply: z.boolean().default(false), count: z.number().int().min(3).max(7).default(5) }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer) return nope(`No layer matched “${a.layer}”.`);
      let colors: string[] = [];
      if (layer.media?.src && deps.vision) {
        try {
          const answer = await deps.vision({
            prompt: `List the ${a.count} dominant colors in this image as a JSON array of hex strings, ordered from most to least dominant. Reply with JSON only.`,
            image: layer.media.src,
          });
          colors = (answer.match(/#[0-9a-f]{6}/gi) ?? []).slice(0, a.count);
        } catch { colors = []; }
      }
      if (!colors.length) {
        colors = [layer.fill, ...state.project.layers.filter((l) => l.type === 'shape').map((l) => l.fill)].filter((c) => /^#[0-9a-f]{3,8}$/i.test(c)).slice(0, a.count);
      }
      if (!colors.length) return nope('Could not determine colors — connect a vision provider for image palettes.');
      let ops: Op[] = [];
      if (a.apply) {
        ops = commit([{ op: 'set_project', patch: { background: colors[colors.length - 1], backgroundGradient: gradient([colors[colors.length - 1], colors[0], colors[1] ?? colors[0]], 135) } }], 'Applied extracted palette');
      }
      return done(`Extracted ${colors.length} colors: ${colors.join(', ')}`, ops, { data: { colors } });
    },
  });

  const detectTextTool = tool({
    description: 'Read the text inside an image layer with real vision, then optionally recreate it as an editable text layer.',
    parameters: z.object({ layer: z.string().min(1), recreate: z.boolean().default(false) }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer?.media?.src) return nope('That layer has no image.');
      if (!deps.vision) return nope('No vision provider connected — cannot read text from images.');
      try {
        const answer = await deps.vision({ prompt: 'Transcribe every piece of visible text in this image exactly, line by line. If there is no text, reply with an empty string.', image: layer.media.src });
        const text = answer.trim();
        if (!text) return { ok: true, summary: 'No legible text found in that image.', data: { text: '' } };
        let ops: Op[] = [];
        if (a.recreate) {
          const t = createText(text, {
            name: 'Read text', x: fx(0.08, W()), y: fx(0.1, H()), w: fx(0.84, W()), h: fx(0.3, H()),
            startTime: 0, endTime: state.project.duration,
          }, { fontSize: Math.round(W() * 0.04), fontFamily: 'Inter', fontWeight: 500, color: layer.fill === '#ffffff' ? '#111114' : '#ffffff' });
          ops = commit([{ op: 'add_layers', layers: [t] }], 'Added transcribed text');
        }
        return done(`Transcribed ${text.split('\n').length} line(s)`, ops, { data: { text } });
      } catch (e) {
        return nope(`Text detection failed: ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    },
  });

  /* ═══════════════════════════════ assets ══════════════════════════════════ */

  const searchStockTool = tool({
    description: 'Search Unsplash/Pexels for real photography. Returns full URLs; set insert=true to place the best match (full-bleed by default). If the server has no stock API keys it says so — then use generate_image or geometric art instead.',
    parameters: z.object({
      query: z.string().min(2).max(120),
      provider: z.enum(['unsplash', 'pexels']).default('unsplash'),
      count: z.number().int().min(1).max(12).default(6),
      insert: z.boolean().default(false),
      index: z.number().int().min(0).max(11).default(0),
      place: z.enum(['full', 'inset']).default('full'),
      x: z.number().default(0.58), y: z.number().default(0.12), w: z.number().default(0.34), h: z.number().default(0.76),
      radius: z.number().min(0).max(600).default(0),
      opacity: z.number().min(0).max(1).default(1),
      credit: z.boolean().default(true),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const { searchStockServer } = await import('@/lib/server/assets');
      const res = await searchStockServer(a.query, a.provider, Math.max(a.count, 6));
      if (!res.results.length) return nope(res.reason ?? `No stock results for “${a.query}”.`);
      const pick = res.results[Math.min(a.index, res.results.length - 1)];
      let ops: Op[] = [];
      if (a.insert) {
        const box = a.place === 'full' ? { x: 0, y: 0, w: 1, h: 1 } : { x: a.x, y: a.y, w: a.w, h: a.h };
        const img = createImage(pick.full, {
          name: `Photo · ${pick.alt.slice(0, 32) || a.query}`,
          x: fx(box.x, W()), y: fx(box.y, H()), w: fx(box.w, W(), 1), h: fx(box.h, H(), 1),
          radius: a.radius, opacity: a.opacity, media: { src: pick.full, fit: 'cover' },
        });
        const layers = [img];
        if (a.credit) {
          layers.push(createText(`${pick.author} / ${pick.provider}`, {
            name: 'Photo credit', x: fx(box.x + 0.01, W()), y: fx(box.y + box.h - 0.04, H()), w: fx(0.4, W()), h: Math.round(W() * 0.014),
            startTime: 0, endTime: state.project.duration, opacity: 0.6,
          }, { fontSize: Math.round(W() * 0.011), fontWeight: 500, color: '#ffffff', letterSpacing: 0.5 }));
        }
        ops = commit([{ op: 'add_layers', layers }], 'Added stock photo');
      }
      return done(`Found ${res.results.length} photos for “${a.query}” on ${a.provider}${a.insert ? ` · inserted “${pick.alt || pick.id}”` : ''}`, ops, {
        data: { results: res.results.slice(0, a.count).map((r) => ({ thumb: r.thumb, full: r.full, author: r.author, alt: r.alt })) },
      });
    },
  });

  const searchIconsTool = tool({
    description: 'Search the icon library (1,544 Lucide vectors) and optionally insert one. Use for UI mockups, feature lists and iconography.',
    parameters: z.object({ query: z.string().min(2).max(60), count: z.number().int().min(1).max(30).default(12), insert: z.boolean().default(false), color: COLOR.default('#ffffff'), size: z.number().min(0.01).max(0.6).default(0.05) }),
    execute: async (a): Promise<ToolOutput> => {
      const icons = await loadIcons();
      const q = a.query.toLowerCase().replace(/\s+/g, '-');
      const hits = Object.keys(icons)
        .map((name) => ({ name, score: name === q ? 120 : name.startsWith(q) ? 90 : name.includes(q) ? 70 - name.length / 20 : 0 }))
        .filter((x) => x.score > 0).sort((x, y) => y.score - x.score).slice(0, a.count);
      if (!hits.length) return nope(`No icons matched “${a.query}”.`);
      let ops: Op[] = [];
      if (a.insert) {
        const src = iconToDataUrl(icons[hits[0].name].svg, a.color, 2, 512);
        const size = fx(a.size, W(), 0.05);
        const layer = createImage(src, { name: `Icon / ${hits[0].name}`, x: fx(0.08, W()), y: fx(0.08, H()), w: size, h: size, media: { src, fit: 'contain' } });
        ops = commit([{ op: 'add_layers', layers: [layer] }], 'Inserted icon');
      }
      return done(`${hits.length} icons for “${a.query}”`, ops, { data: { icons: hits.map((h) => h.name) } });
    },
  });

  const searchFontsTool = tool({
    description: 'Search available typefaces by feel (serif, grotesk, display, mono, handwritten) and optionally apply the winner to text layers.',
    parameters: z.object({
      query: z.string().max(60).default(''),
      category: z.enum(['Sans', 'Serif', 'Display', 'Mono', 'Script']).optional(),
      apply: z.boolean().default(false),
      layers: z.array(z.string()).max(40).optional(),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const q = a.query.toLowerCase();
      const matches = FONTS.filter((f) => (!a.category || f.category === a.category) && (!q || f.family.toLowerCase().includes(q) || f.category.toLowerCase().includes(q))).slice(0, 14);
      if (!matches.length) return nope(`No fonts matched “${a.query}”.`);
      let ops: Op[] = [];
      if (a.apply) {
        const targets = a.layers?.length ? refs(a.layers) : state.project.layers.filter((l) => l.type === 'text');
        const heading = matches[0].family;
        const body = matches[1]?.family ?? 'Inter';
        const sorted = [...targets].sort((x, y) => (y.text?.fontSize ?? 0) - (x.text?.fontSize ?? 0));
        ops = commit(sorted.map((l, i): Op => ({ op: 'update_layer', id: l.id, patch: { text: { ...l.text!, fontFamily: i === 0 ? heading : body } } })), 'Applied typefaces');
      }
      return done(`${matches.length} typefaces${a.apply ? ` · applied ${matches[0].family}` : ''}`, ops, { data: { fonts: matches.map((m) => ({ family: m.family, category: m.category, weights: m.weights })) } });
    },
  });

  const searchMusicTool = tool({
    description: 'List royalty-free procedural soundtracks and SFX with mood, BPM and length. Follow with add_music to place one.',
    parameters: z.object({ query: z.string().max(60).default(''), kind: z.enum(['music', 'sfx']).default('music') }),
    execute: async (a): Promise<ToolOutput> => {
      const q = a.query.toLowerCase();
      const pool = MUSIC_TRACKS.filter((t) => t.kind === a.kind && (!q || `${t.name} ${t.mood}`.toLowerCase().includes(q))).slice(0, 12);
      return done(`${pool.length} ${a.kind} track${pool.length === 1 ? '' : 's'}${q ? ` matching “${a.query}”` : ''}`, [], { data: { tracks: pool.map((t) => ({ id: t.id, name: t.name, mood: t.mood, bpm: t.bpm, seconds: t.duration })) } });
    },
  });

  /* ═══════════════════════════ layout & styling ═══════════════════════════ */

  const generatePaletteTool = tool({
    description: 'Derive a disciplined 5-color palette from the brief (or explicit brand colors) and optionally apply it to the canvas background. Returns named roles: primary, accent, secondary, stage, ink.',
    parameters: z.object({ brief: z.string().min(2).max(400), apply: z.boolean().default(false) }),
    execute: async (a): Promise<ToolOutput> => {
      const colors = pickPalette(a.brief);
      const roles = { primary: colors[0], accent: colors[1], secondary: colors[2] ?? colors[1], stage: colors[3] ?? '#0b0b12', ink: colors[4] ?? '#ffffff' };
      let ops: Op[] = [];
      if (a.apply) ops = commit([{ op: 'set_project', patch: { background: roles.stage, backgroundGradient: gradient([roles.stage, roles.primary, roles.accent], 135) } }], 'Applied palette');
      return done(`Palette: ${Object.entries(roles).map(([k, v]) => `${k} ${v}`).join(' · ')}`, ops, { data: roles });
    },
  });

  const autoLayoutTool = tool({
    description: 'Arrange layers on a clean grid — row, column, grid or stack — with consistent gutters. Faster and more precise than placing each layer by hand.',
    parameters: z.object({
      layers: z.array(z.string()).min(2).max(40),
      mode: z.enum(['row', 'column', 'grid', 'stack']).default('column'),
      columns: z.number().int().min(1).max(6).default(2),
      gap: z.number().min(0).max(0.2).default(0.03),
      padding: z.number().min(0).max(0.3).default(0.07),
      align: z.enum(['start', 'center', 'end']).default('start'),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const found = refs(a.layers);
      if (found.length < 2) return nope('Need at least two layers to lay out.');
      const pad = fx(a.padding, W(), 0.07);
      const gap = fx(a.gap, W(), 0.03);
      const areaW = W() - pad * 2;
      const areaH = H() - pad * 2;
      const ops: Op[] = [];
      if (a.mode === 'column' || a.mode === 'stack') {
        const step = (areaH - gap * (found.length - 1)) / found.length;
        found.forEach((l, i) => ops.push({ op: 'update_layer', id: l.id, patch: { x: a.align === 'center' ? Math.round((W() - l.w) / 2) : a.align === 'end' ? W() - pad - l.w : pad, y: Math.round(pad + i * (step + gap)) } }));
      } else if (a.mode === 'row') {
        const step = (areaW - gap * (found.length - 1)) / found.length;
        found.forEach((l, i) => ops.push({ op: 'update_layer', id: l.id, patch: { x: Math.round(pad + i * (step + gap)), y: Math.round((H() - l.h) / 2) } }));
      } else {
        const cols = a.columns;
        const cellW = (areaW - gap * (cols - 1)) / cols;
        const rows = Math.ceil(found.length / cols);
        const cellH = (areaH - gap * (rows - 1)) / rows;
        found.forEach((l, i) => {
          const c = i % cols, r = Math.floor(i / cols);
          ops.push({ op: 'update_layer', id: l.id, patch: { x: Math.round(pad + c * (cellW + gap)), y: Math.round(pad + r * (cellH + gap)) } });
        });
      }
      return done(`Laid out ${found.length} layers as a ${a.mode} with ${a.gap}s gutters`, commit(ops, 'Auto layout'));
    },
  });

  const styleTransferTool = tool({
    description: 'Apply a coherent art-direction treatment to the whole canvas (or a subset): duotone, neon, editorial monochrome, film, print/poster, glassmorphism. Recolors layers and adds restrained finishing effects.',
    parameters: z.object({
      style: z.enum(['duotone', 'neon', 'mono', 'film', 'print', 'glass']).default('duotone'),
      layers: z.array(z.string()).max(40).optional(),
      palette: z.array(COLOR).min(2).max(4).optional(),
      strength: z.number().min(0.2).max(1).default(0.8),
    }),
    execute: async (a): Promise<ToolOutput> => {
      const targets = a.layers?.length ? refs(a.layers) : state.project.layers.filter((l) => l.type !== 'audio');
      if (!targets.length) return nope('No visual layers to restyle.');
      const colors = a.palette ?? pickPalette(`${a.style} ${state.project.name}`);
      const ops: Op[] = [];
      const shade = (i: number) => colors[i % colors.length];
      targets.forEach((l, i) => {
        const patch: Partial<Layer> = {};
        if (a.style === 'duotone') patch.fill = shade(i % 2 === 0 ? 0 : 1);
        if (a.style === 'neon') patch.fill = i % 3 === 0 ? colors[0] : colors[1];
        if (a.style === 'mono') patch.fill = i % 2 === 0 ? '#f4f4f5' : '#18181b';
        if (a.style === 'print') patch.fill = i % 2 === 0 ? colors[0] : colors[2] ?? colors[1];
        if (a.style === 'glass') { patch.fill = 'rgba(255,255,255,0.12)'; patch.stroke = 'rgba(255,255,255,0.28)'; patch.strokeWidth = 1; }
        if (l.type === 'text' && l.text && a.style !== 'film') patch.text = { ...l.text, color: a.style === 'mono' ? '#fafafa' : l.text.color };
        const effects = [...l.effects];
        if (a.style === 'film' && !effects.some((e) => e.type === 'grain')) effects.push(newEffect('grain', 22 * a.strength));
        if (a.style === 'neon' && !effects.some((e) => e.type === 'glow')) effects.push(newEffect('glow', 45 * a.strength, { color: colors[0] }));
        if (a.style === 'print' && !effects.some((e) => e.type === 'vignette')) effects.push(newEffect('vignette', 26 * a.strength));
        if (a.style === 'glass' && !effects.some((e) => e.type === 'blur')) effects.push(newEffect('blur', 1.4, { blur: 10 }));
        if (effects.length !== l.effects.length) patch.effects = effects;
        if (Object.keys(patch).length) ops.push({ op: 'update_layer', id: l.id, patch });
      });
      return done(`Applied ${a.style} treatment to ${ops.length} layer${ops.length === 1 ? '' : 's'}`, commit(ops, `Style ${a.style}`));
    },
  });

  const smartReframeTool = tool({
    description: 'Reframe the composition to another aspect ratio (e.g. 16:9 → 9:16 for Reels) by repositioning and rescaling every layer around its focal point.',
    parameters: z.object({ aspect: z.enum(['16:9', '9:16', '1:1', '4:5', '4:3', '3:2']) }),
    execute: async (a): Promise<ToolOutput> => {
      const next = smartReframeOps(state.project, a.aspect as Aspect);
      const [w, h] = aspectSize(a.aspect as keyof typeof ASPECTS, [state.project.width, state.project.height]);
      const ops: Op[] = [
        { op: 'set_project', patch: { width: next.width, height: next.height } },
        ...next.updates.map((u): Op => ({ op: 'update_layer', id: u.id, patch: { x: u.x, y: u.y, w: u.w, h: u.h } })),
      ];
      void w; void h;
      return done(`Reframed to ${a.aspect} (${next.width}×${next.height}) — ${next.updates.length} layers repositioned`, commit(ops, `Reframe ${a.aspect}`), { data: { width: next.width, height: next.height } });
    },
  });

  const clearKeyframesTool = tool({
    description: 'Remove animation from a layer — all properties or a single one.',
    parameters: z.object({ layer: z.string().min(1), property: z.enum(ANIM_PROPS).optional() }),
    execute: async (a): Promise<ToolOutput> => {
      const layer = find(a.layer);
      if (!layer) return nope(`No layer matched “${a.layer}”.`);
      return done(`Cleared ${a.property ?? 'all'} keyframes on ${layer.name}`, commit([{ op: 'clear_keyframes', layerId: layer.id, prop: a.property as AnimatableProp | undefined }], 'Cleared keyframes'));
    },
  });

  /* ═══════════════════════════════ delivery ═══════════════════════════════ */

  const renderPreviewTool = tool({
    description: 'Open the preview player in the editor so the user can watch, scrub and frame-step the result. Call this when the build is complete (and before export).',
    parameters: z.object({ autoplay: z.boolean().default(true) }),
    execute: async (a): Promise<ToolOutput> => ({ ok: true, summary: 'Preview opened for review', clientAction: { type: 'preview', autoplay: a.autoplay } }),
  });

  const exportTool = tool({
    description: 'Export the project. Video: mp4 (H.264 when the browser supports it, otherwise WebM), webm, gif. Stills: png, jpg, svg, pdf. Motion data: lottie. The export runs in the editor’s real render pipeline.',
    parameters: z.object({
      format: z.enum(['mp4', 'webm', 'gif', 'png', 'jpg', 'svg', 'pdf', 'lottie']).default('mp4'),
      preset: z.enum(['1080p', '4k', 'instagram-square', 'instagram-portrait', 'tiktok', 'youtube', 'custom']).optional(),
      fps: z.number().int().min(8).max(60).optional(),
      scale: z.number().min(0.25).max(3).optional(),
      transparent: z.boolean().default(false),
    }),
    execute: async (a): Promise<ToolOutput> => ({
      ok: true,
      summary: `Queued ${a.format.toUpperCase()} export${a.preset ? ` at ${a.preset}` : ''}`,
      clientAction: { type: 'export', options: { format: a.format, preset: a.preset, fps: a.fps, scale: a.scale, transparent: a.transparent } },
      data: { format: a.format, preset: a.preset },
    }),
  });

  const openCutoutTool = tool({
    description: 'Open the manual cut-out studio for an image layer so the user can erase exactly what they want (brush, magic wand, or colour key). Prism never guesses a removal automatically — this is the only background-removal path. Use when the user asks to remove/replace a background, cut out a subject, or key out a colour. Tell the user to paint, then wait for them to apply it.',
    parameters: z.object({
      layer: z.string().min(1).describe('Layer id or name of the image to cut out'),
      mode: z.enum(['remove', 'keep']).default('remove'),
      hint: z.string().max(200).optional(),
    }),
    execute: async ({ layer: ref, mode, hint }): Promise<ToolOutput> => {
      const target = find(ref);
      if (!target) return nope(`No layer matches “${ref}”.`);
      if (target.type !== 'image' || !target.media?.src) return nope(`“${target.name}” is not an image layer with a source.`);
      const current = target.cutout ? `A cut-out already exists (${target.cutout.mode}).` : 'No cut-out yet.';
      return done(
        `Opening the cut-out studio for “${target.name}” in ${mode === 'keep' ? 'keep' : 'remove'} mode. ${current} Paint or colour-pick, then Apply.`,
        [],
        { clientAction: { type: 'cutout', layerId: target.id }, data: { layerId: target.id, mode, hint } },
      );
    },
  });

  const saveProjectTool = tool({
    description: 'Checkpoint the project (the editor autosaves continuously; this marks a named save point the user can rely on). Call after a big build.',
    parameters: z.object({ note: z.string().max(140).optional() }),
    execute: async (a): Promise<ToolOutput> => {
      const ops = commit([{ op: 'set_project', patch: { updatedAt: Date.now() } }], 'Saved');
      return done(`Saved “${state.project.name}”${a.note ? ` — ${a.note}` : ''}`, ops, { clientAction: { type: 'saved', id: state.project.id } });
    },
  });

  /* ═══════════════════════════════ tools ═══════════════════════════════════ */

  const tools = {
    set_plan: setPlan,
    complete_step: completeStep,
    ask_user: askUser,
    open_cutout_studio: openCutoutTool,
    get_project_state: getState,
    create_project: createProjectTool,
    generate_design: generateDesignTool,
    generate_motion_scene: generateMotionTool,
    apply_template: applyTemplateTool,
    set_copy: setCopyTool,
    add_shape: addShapeTool,
    add_text: addTextTool,
    add_image: addImageTool,
    add_icon: addIconTool,
    add_backdrop: addBackdropTool,
    add_captions: addCaptionsTool,
    add_music: addMusicTool,
    add_video: addVideoTool,
    add_voiceover: voiceoverTool,
    generate_image: generateImageTool,
    analyze_image: analyzeImageTool,
    extract_colors: extractColorsTool,
    detect_text: detectTextTool,
    search_stock: searchStockTool,
    search_icons: searchIconsTool,
    search_fonts: searchFontsTool,
    search_music: searchMusicTool,
    generate_palette: generatePaletteTool,
    auto_layout: autoLayoutTool,
    apply_style_transfer: styleTransferTool,
    smart_reframe: smartReframeTool,
    clear_keyframes: clearKeyframesTool,
    render_preview: renderPreviewTool,
    export_project: exportTool,
    save_project: saveProjectTool,
    set_layer: setLayerTool,
    duplicate_layers: duplicateTool,
    delete_layers: deleteTool,
    reorder_layer: reorderTool,
    group_layers: groupTool,
    ungroup_layer: ungroupTool,
    align_layers: alignTool,
    distribute_layers: distributeTool,
    parent_layer: parentTool,
    add_keyframe: addKeyframeTool,
    set_keyframes: setKeyframesTool,
    apply_motion_preset: presetTool,
    add_effect: effectTool,
    remove_effect: removeEffectTool,
    add_mask: maskTool,
    add_transition: transitionTool,
    set_timing: timingTool,
    trim_layer: trimTool,
    add_particles: particlesTool,
    add_physics: physicsTool,
    animate_image: animateImageTool,
  };

  return {
    tools,
    toolNames: Object.keys(tools),
    getOps: () => state.ops,
    getProject: () => state.project,
  };
}

export type Toolbelt = ReturnType<typeof createToolbelt>;

function animatedCount(layers: { animated: string[] }[]) {
  const n = layers.filter((l) => l.animated.length).length;
  return `${n} layer${n === 1 ? ' is' : 's are'}`;
}

void copyFromBrief;
void FONTS;
void saveGenerated;
void smartReframeOps;
void captionLayers;
void imageMotionLayers;
