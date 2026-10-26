import { tool } from "ai";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { AgentOp, EasingName } from "../types";
import { makeKeyframe, makeLayer } from "../layers";

/**
 * PRISM agent toolbelt. Every tool is Zod-validated and executes server-side,
 * returning a structured `AgentOp` that the client applies to the editor
 * store in real time (see store.applyOp). Layer ids are minted here so the
 * model can deterministically chain: create → style → keyframe.
 */

const easingEnum = z.enum([
  "linear", "easeIn", "easeOut", "easeInOut", "easeOutCubic", "easeInOutCubic", "easeOutBack", "easeOutElastic", "easeOutBounce", "spring",
]);

const gradientSchema = z.object({
  kind: z.enum(["linear", "radial", "conic"]),
  angle: z.number().optional(),
  stops: z.array(z.object({ offset: z.number().min(0).max(1), color: z.string() })).min(2),
});

export interface ToolContext {
  canvas: { width: number; height: number; duration: number };
  ops: AgentOp[];
}

export function buildTools(ctx: ToolContext) {
  const push = (op: AgentOp) => {
    ctx.ops.push(op);
    return op;
  };

  return {
    create_project: tool({
      description:
        "Create (or reset) the project composition: name, canvas size in px, fps, duration in seconds, background color/gradient. Call this FIRST for any new deliverable. Common sizes: HD 1920x1080, Instagram post 1080x1080, Story/Reels/TikTok 1080x1920, YouTube thumbnail 1280x720, poster 1240x1754.",
      parameters: z.object({
        name: z.string(),
        width: z.number().int().min(64).max(7680),
        height: z.number().int().min(64).max(7680),
        fps: z.number().int().min(12).max(60).default(30),
        duration: z.number().min(1).max(120),
        background: z.string().describe("CSS hex color, e.g. #0b0b14"),
        backgroundGradient: gradientSchema.optional(),
      }),
      execute: async (args) => {
        ctx.canvas = { width: args.width, height: args.height, duration: args.duration };
        const op = push({
          op: "create_project",
          project: {
            name: args.name, width: args.width, height: args.height, fps: args.fps,
            duration: args.duration, background: args.background,
            backgroundGradient: args.backgroundGradient ?? null,
          },
        });
        return { ok: true, op, message: `Project "${args.name}" created at ${args.width}x${args.height}, ${args.duration}s.` };
      },
    }),

    set_background: tool({
      description: "Change the composition background color and/or gradient without touching layers.",
      parameters: z.object({ background: z.string(), gradient: gradientSchema.optional() }),
      execute: async (args) => ({ ok: true, op: push({ op: "set_background", background: args.background, gradient: args.gradient ?? null }) }),
    }),

    add_text: tool({
      description:
        "Add a text layer. Coordinates are top-left in canvas pixels. Use generous font sizes relative to canvas (headline ≈ 8-12% of canvas width). Returns layerId for keyframing.",
      parameters: z.object({
        text: z.string(),
        name: z.string().optional(),
        x: z.number(), y: z.number(), width: z.number(), height: z.number(),
        fontSize: z.number().min(8).max(900),
        fontFamily: z.string().default("Space Grotesk"),
        fontWeight: z.number().min(100).max(900).default(700),
        color: z.string().default("#ffffff"),
        align: z.enum(["left", "center", "right"]).default("center"),
        letterSpacing: z.number().default(0),
        lineHeight: z.number().default(1.1),
        gradient: gradientSchema.optional(),
        startTime: z.number().min(0).default(0),
        duration: z.number().min(0.1).optional(),
      }),
      execute: async (args) => {
        const layer = makeLayer({
          id: `layer_${nanoid(8)}`, type: "text", name: args.name ?? args.text.slice(0, 24) ?? "Text",
          text: args.text, x: args.x, y: args.y, width: args.width, height: args.height,
          fontSize: args.fontSize, fontFamily: args.fontFamily, fontWeight: args.fontWeight,
          fill: args.color, align: args.align, letterSpacing: args.letterSpacing, lineHeight: args.lineHeight,
          gradient: args.gradient ?? null, startTime: args.startTime, duration: args.duration ?? ctx.canvas.duration,
        });
        return { ok: true, layerId: layer.id, op: push({ op: "add_layer", layer }) };
      },
    }),

    add_shape: tool({
      description: "Add a shape layer: rect (use cornerRadius for rounded/pill), ellipse, polygon (points>=3), star, or line. Returns layerId.",
      parameters: z.object({
        shape: z.enum(["rect", "ellipse", "polygon", "star", "line"]),
        name: z.string().optional(),
        x: z.number(), y: z.number(), width: z.number().min(1), height: z.number().min(1),
        fill: z.string().default("#7c3aed"),
        gradient: gradientSchema.optional(),
        stroke: z.string().default("transparent"),
        strokeWidth: z.number().default(0),
        cornerRadius: z.number().default(0),
        points: z.number().int().min(3).max(24).default(5),
        rotation: z.number().default(0),
        opacity: z.number().min(0).max(1).default(1),
        startTime: z.number().min(0).default(0),
        duration: z.number().min(0.1).optional(),
      }),
      execute: async (args) => {
        const layer = makeLayer({
          id: `layer_${nanoid(8)}`, type: args.shape, name: args.name ?? args.shape,
          x: args.x, y: args.y, width: args.width, height: args.height, fill: args.fill,
          gradient: args.gradient ?? null, stroke: args.stroke, strokeWidth: args.strokeWidth,
          cornerRadius: args.cornerRadius, points: args.points, rotation: args.rotation,
          opacity: args.opacity, startTime: args.startTime, duration: args.duration ?? ctx.canvas.duration,
        });
        return { ok: true, layerId: layer.id, op: push({ op: "add_layer", layer }) };
      },
    }),

    add_image: tool({
      description: "Add an image layer from a URL or data URL (e.g. a user-uploaded image reference like 'upload:0' is NOT valid — pass an http(s) URL or full data URL). Returns layerId.",
      parameters: z.object({
        src: z.string(),
        name: z.string().optional(),
        x: z.number(), y: z.number(), width: z.number().min(1), height: z.number().min(1),
        cornerRadius: z.number().default(0),
        opacity: z.number().min(0).max(1).default(1),
        startTime: z.number().min(0).default(0),
        duration: z.number().min(0.1).optional(),
      }),
      execute: async (args) => {
        const layer = makeLayer({
          id: `layer_${nanoid(8)}`, type: "image", name: args.name ?? "Image", src: args.src,
          x: args.x, y: args.y, width: args.width, height: args.height,
          cornerRadius: args.cornerRadius, opacity: args.opacity,
          startTime: args.startTime, duration: args.duration ?? ctx.canvas.duration,
        });
        return { ok: true, layerId: layer.id, op: push({ op: "add_layer", layer }) };
      },
    }),

    set_layer_property: tool({
      description: "Update properties of an existing layer (position, size, rotation, opacity, fill, text content, timing, visibility).",
      parameters: z.object({
        layerId: z.string(),
        patch: z.object({
          x: z.number().optional(), y: z.number().optional(),
          width: z.number().optional(), height: z.number().optional(),
          rotation: z.number().optional(), opacity: z.number().min(0).max(1).optional(),
          scale: z.number().optional(), fill: z.string().optional(),
          text: z.string().optional(), fontSize: z.number().optional(),
          fontWeight: z.number().optional(), fontFamily: z.string().optional(),
          align: z.enum(["left", "center", "right"]).optional(),
          cornerRadius: z.number().optional(), visible: z.boolean().optional(),
          startTime: z.number().optional(), duration: z.number().optional(),
          blendMode: z.string().optional(), gradient: gradientSchema.nullable().optional(),
        }),
      }),
      execute: async (args) => ({ ok: true, op: push({ op: "update_layer", layerId: args.layerId, patch: args.patch }) }),
    }),

    delete_layer: tool({
      description: "Delete a layer by id.",
      parameters: z.object({ layerId: z.string() }),
      execute: async (args) => ({ ok: true, op: push({ op: "delete_layer", layerId: args.layerId }) }),
    }),

    add_keyframe: tool({
      description:
        "Add a keyframe to a layer. property: x|y (px), scale/scaleX/scaleY (multiplier), rotation (deg), opacity (0-1). time is absolute seconds. To animate, add at least two keyframes for the same property; the easing on the LATER keyframe shapes the segment. Entrance pattern: opacity 0→1 + y +40→base with easeOutCubic; pop: scale 0→1 easeOutBack/Elastic.",
      parameters: z.object({
        layerId: z.string(),
        time: z.number().min(0),
        property: z.enum(["x", "y", "scale", "scaleX", "scaleY", "rotation", "opacity"]),
        value: z.number(),
        easing: easingEnum.default("easeOutCubic"),
      }),
      execute: async (args) => {
        const keyframe = makeKeyframe({ id: `kf_${nanoid(8)}`, time: args.time, property: args.property, value: args.value, easing: args.easing as EasingName });
        return { ok: true, keyframeId: keyframe.id, op: push({ op: "add_keyframe", layerId: args.layerId, keyframe }) };
      },
    }),

    add_effect: tool({
      description: "Add a visual effect to a layer: shadow (offset drop shadow), glow (colored halo), blur, or outline.",
      parameters: z.object({
        layerId: z.string(),
        type: z.enum(["shadow", "glow", "blur", "outline"]),
        color: z.string().default("#000000"),
        blur: z.number().min(0).max(120).default(16),
        offsetX: z.number().default(0),
        offsetY: z.number().default(8),
        opacity: z.number().min(0).max(1).default(0.6),
      }),
      execute: async (args) => ({
        ok: true,
        op: push({
          op: "add_effect", layerId: args.layerId,
          effect: { id: `fx_${nanoid(8)}`, type: args.type, color: args.color, blur: args.blur, offsetX: args.offsetX, offsetY: args.offsetY, opacity: args.opacity },
        }),
      }),
    }),

    set_duration: tool({
      description: "Set the total composition duration in seconds.",
      parameters: z.object({ duration: z.number().min(0.5).max(300) }),
      execute: async (args) => {
        ctx.canvas.duration = args.duration;
        return { ok: true, op: push({ op: "set_duration", duration: args.duration }) };
      },
    }),

    generate_palette: tool({
      description: "Commit a brand palette + font pairing to the project's brand kit. Call after deciding the art direction so later steps stay consistent.",
      parameters: z.object({
        name: z.string(),
        colors: z.array(z.string()).min(3).max(8),
        displayFont: z.string(),
        bodyFont: z.string(),
        rationale: z.string(),
      }),
      execute: async (args) => ({
        ok: true,
        palette: args.colors,
        op: push({ op: "set_brand_kit", brandKit: { name: args.name, colors: args.colors, fonts: { display: args.displayFont, body: args.bodyFont } } }),
      }),
    }),

    narrate: tool({
      description: "Emit a short human-readable progress note shown in the Agent Run panel (e.g. 'Scene 2 of 3 — animating the headline'). Use between build phases. Does not modify the canvas.",
      parameters: z.object({ message: z.string() }),
      execute: async (args) => ({ ok: true, op: push({ op: "note", message: args.message }) }),
    }),
  };
}

export type PrismTools = ReturnType<typeof buildTools>;

export const TOOL_CATALOG = [
  "create_project — set canvas size, duration, background (call first)",
  "set_background — recolor / gradient the canvas",
  "add_text — headlines, body, CTAs (returns layerId)",
  "add_shape — rect/ellipse/polygon/star/line (returns layerId)",
  "add_image — image from URL/data URL (returns layerId)",
  "set_layer_property — move/resize/restyle an existing layer",
  "delete_layer — remove a layer",
  "add_keyframe — animate x/y/scale/rotation/opacity over time",
  "add_effect — shadow/glow/blur/outline",
  "set_duration — composition length",
  "generate_palette — commit brand colors + fonts",
  "narrate — progress note to the user",
].join("\n");
