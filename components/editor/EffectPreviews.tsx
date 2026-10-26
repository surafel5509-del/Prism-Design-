'use client';
import * as React from 'react';
import type { EffectType } from '@/lib/engine/types';
import { ANIMATION_PRESETS, applyPresetToLayer, type AnimationPreset } from '@/lib/engine/presets';
import { resolveLayer } from '@/lib/engine/animation';
import { createLayer } from '@/lib/engine/factory';
import { cn } from '@/lib/utils';
import { Play } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
//  Animated in-place previews. Motion previews resolve the *real* preset
//  keyframes against a dummy layer; effect previews animate the same CSS
//  transform/filter vocabulary the renderer applies. No static icon grids.
// ─────────────────────────────────────────────────────────────────────────────

const clockStore = (() => {
  let listeners = new Set<() => void>();
  let tick = 0;
  let raf = 0;
  let last = 0;
  const loop = (now: number) => {
    if (now - last > 40) {
      last = now;
      tick = (tick + 1) % 100000;
      listeners.forEach((l) => l());
    }
    raf = requestAnimationFrame(loop);
  };
  return {
    subscribe(l: () => void) {
      listeners.add(l);
      if (!raf) raf = requestAnimationFrame(loop);
      return () => {
        listeners.delete(l);
        if (!listeners.size) { cancelAnimationFrame(raf); raf = 0; }
      };
    },
    get: () => tick,
  };
})();

/** 25 fps shared clock — one rAF for the whole library. */
function usePreviewClock(): number {
  return React.useSyncExternalStore(clockStore.subscribe, clockStore.get, () => 0);
}

// ── Motion presets ───────────────────────────────────────────────────────────
const dummyBase = createLayer({ type: 'shape', x: 0, y: 0, w: 40, h: 40, shape: 'roundedRect' });

function presetTrack(preset: AnimationPreset) {
  const applied = preset.apply(dummyBase, 1.2);
  if ('textAnimator' in applied) return { textAnimator: applied.textAnimator as string, duration: 1.2 };
  const tracks = applied as Record<string, { time: number }[]>;
  const end = Object.values(tracks).reduce((m, ks) => Math.max(m, ...ks.map((k) => k.time)), 0.4);
  const probe = { ...dummyBase, keyframes: applied as never };
  return { probe, duration: end, textAnimator: null as string | null };
}

function MotionThumb({ preset, playing }: { preset: AnimationPreset; playing: boolean }) {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      if (!cancelled && now - last > 40) { last = now; setTick((v) => v + 1); }
      if (!cancelled) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, []);
  const track = React.useMemo(() => presetTrack(preset), [preset]);
  const t = React.useMemo(() => {
    if (!playing) return Math.min(track.duration * 0.75, 0.6);
    const cycle = track.duration + 0.5;
    return Math.max(0, Math.min(track.duration, (tick / 25) % cycle));
  }, [tick, playing, track.duration]);
  void tick;

  if (track.textAnimator) {
    const p = playing ? Math.min(1, (tick / 25 / 1.4) % 1) : 0.55;
    const letters = ['P', 'R', 'I', 'S', 'M'];
    return (
      <div className="relative grid h-full w-full place-items-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,.28),transparent_65%)]">
        <span className="flex gap-[2px] text-[11px] font-black tracking-tight text-white">
          {letters.map((ch, i) => {
            const local = Math.max(0, Math.min(1, p * 1.8 - i * 0.14));
            return (
              <span key={i} style={{
                opacity: track.textAnimator === 'typewriter' ? (p * 5 > i ? 1 : 0.08) : local,
                transform: track.textAnimator === 'charRise' ? `translateY(${(1 - local) * 6}px)` : track.textAnimator === 'scaleIn' ? `scale(${0.6 + local * 0.4})` : undefined,
                filter: track.textAnimator === 'blurIn' ? `blur(${(1 - local) * 2.5}px)` : undefined,
              }}>{ch}</span>
            );
          })}
        </span>
      </div>
    );
  }

  const layer = { ...(track.probe as typeof dummyBase) };
  const r = resolveLayer(layer, t);
  const dx = (r.x - dummyBase.x) * 0.075;
  const dy = (r.y - dummyBase.y) * 0.075;
  const rot = r.rotation - dummyBase.rotation;
  const sx = r.scaleX, sy = r.scaleY;
  const blur = Math.min(6, r.blur * 0.22);

  return (
    <div className="relative grid h-full w-full place-items-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,.20),transparent_65%)]">
      <span className="pointer-events-none absolute inset-x-2 bottom-1 h-[1px] bg-white/[0.06]" />
      <span
        className="block h-[26px] w-[26px] rounded-[7px] bg-gradient-to-br from-violet-300 via-fuchsia-300 to-cyan-300 shadow-[0_6px_16px_-6px_rgba(167,139,250,.9)]"
        style={{
          transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})`,
          opacity: r.opacity,
          filter: `blur(${blur}px) brightness(${Math.min(160, r.brightness as number)}%) hue-rotate(${r.hue as number}deg)`,
        }}
      />
    </div>
  );
}

export function MotionPresetCard({
  preset, onApply, disabled, playing = true,
}: { preset: AnimationPreset; onApply: () => void; disabled?: boolean; playing?: boolean }) {
  return (
    <button
      onClick={onApply}
      disabled={disabled}
      title={`${preset.name} — ${preset.description}`}
      className={cn(
        'group relative overflow-hidden rounded-lg border border-white/[0.07] bg-background/40 text-left transition-all',
        'hover:-translate-y-0.5 hover:border-violet-400/45 hover:shadow-[0_10px_28px_-18px_rgba(139,92,246,.9)]',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0',
      )}
    >
      <div className="relative aspect-[4/3] w-full bg-[#0b0b12]">
        <MotionThumb preset={preset} playing={playing && !disabled} />
        <span className="pointer-events-none absolute inset-0 rounded-t-lg ring-1 ring-inset ring-white/[0.05]" />
        <span className="pointer-events-none absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-black/45 text-white/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <Play className="h-2 w-2 translate-x-[0.5px]" />
        </span>
      </div>
      <span className="block truncate px-1.5 py-1 text-[9px] font-medium leading-tight text-foreground/85">{preset.name}</span>
    </button>
  );
}

export function MotionPresetGrid({
  presets, onApply, disabled, columns = 3,
}: { presets: AnimationPreset[]; onApply: (id: string) => void; disabled?: boolean; columns?: 2 | 3 }) {
  const [hovered, setHovered] = React.useState<string | null>(null);
  void usePreviewClock();
  return (
    <div className={cn('grid gap-1.5', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')} onMouseLeave={() => setHovered(null)}>
      {presets.map((p) => (
        <div key={p.id} onMouseEnter={() => setHovered(p.id)}>
          <MotionPresetCard
            preset={p}
            onApply={() => onApply(p.id)}
            disabled={disabled}
            playing={!hovered || hovered === p.id}
          />
        </div>
      ))}
    </div>
  );
}

// ── Effects ──────────────────────────────────────────────────────────────────
const FX_CSS = `
.pfx-thumb { position: relative; overflow: hidden; border-radius: 8px 8px 0 0; background: #0b0b12; }
.pfx-scene { position: absolute; inset: 0; background: radial-gradient(circle at 30% 26%, rgba(139,92,246,.55), transparent 62%), radial-gradient(circle at 76% 74%, rgba(34,211,238,.45), transparent 60%), linear-gradient(140deg,#171426,#0a0a12 70%); }
.pfx-subject { position: absolute; left: 50%; top: 50%; height: 26px; width: 26px; margin: -13px 0 0 -13px; border-radius: 8px; background: linear-gradient(145deg,#e9d5ff,#f0abfc 45%,#67e8f9); box-shadow: 0 6px 16px -6px rgba(167,139,250,.9); }
.pfx-bar { position: absolute; left: 22%; bottom: 20%; height: 4px; width: 34%; border-radius: 2px; background: rgba(255,255,255,.72); }
.pfx-overlay { position: absolute; inset: 0; pointer-events: none; }
@keyframes pfx-blur { 0%,100%{filter:blur(0)} 50%{filter:blur(2.6px)} }
.pfx-blur .pfx-scene, .pfx-blur .pfx-subject { animation: pfx-blur 2.4s ease-in-out infinite; }
@keyframes pfx-glow { 0%,100%{opacity:.25; transform:scale(.92)} 50%{opacity:.85; transform:scale(1.18)} }
.pfx-glow .pfx-overlay, .pfx-bloom .pfx-overlay { background: radial-gradient(circle at 50% 50%, rgba(255,255,255,.85), rgba(232,121,249,.45) 40%, transparent 70%); filter: blur(6px); animation: pfx-glow 2.6s ease-in-out infinite; mix-blend-mode: screen; }
@keyframes pfx-shadow { 0%,100%{transform:translate(-4px,4px)} 50%{transform:translate(6px,8px)} }
.pfx-shadow .pfx-subject, .pfx-dropShadow .pfx-subject { animation: pfx-shadow 2.8s ease-in-out infinite; }
.pfx-shadow .pfx-subject, .pfx-dropShadow .pfx-subject { box-shadow: 6px 8px 10px rgba(0,0,0,.65); }
@keyframes pfx-bright { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.55)} }
.pfx-brightness .pfx-scene, .pfx-brightness .pfx-subject { animation: pfx-bright 2.4s ease-in-out infinite; }
@keyframes pfx-contrast { 0%,100%{filter:contrast(1)} 50%{filter:contrast(1.7)} }
.pfx-contrast .pfx-scene, .pfx-contrast .pfx-subject { animation: pfx-contrast 2.6s ease-in-out infinite; }
@keyframes pfx-sat { 0%,100%{filter:saturate(.3)} 50%{filter:saturate(2.1)} }
.pfx-saturate .pfx-scene, .pfx-saturate .pfx-subject { animation: pfx-sat 2.8s ease-in-out infinite; }
@keyframes pfx-hue { to { filter: hue-rotate(360deg); } }
.pfx-hue .pfx-scene, .pfx-hue .pfx-subject, .pfx-thermal .pfx-scene, .pfx-thermal .pfx-subject { animation: pfx-hue 5s linear infinite; }
.pfx-thermal .pfx-scene, .pfx-thermal .pfx-subject { filter: saturate(1.9) contrast(1.25); }
.pfx-gray .pfx-scene, .pfx-gray .pfx-subject { filter: grayscale(1); }
.pfx-sepia .pfx-scene, .pfx-sepia .pfx-subject { filter: sepia(.85); }
.pfx-invert .pfx-scene, .pfx-invert .pfx-subject { filter: invert(1); }
.pfx-posterize .pfx-scene, .pfx-posterize .pfx-subject { filter: contrast(1.8) saturate(1.4); animation: pfx-contrast 3s ease-in-out infinite; }
@keyframes pfx-chroma { 0%,100%{text-shadow:none; transform:translateX(0)} 50%{transform:translateX(1.5px)} }
.pfx-chromatic .pfx-subject { box-shadow: 2px 0 0 rgba(244,63,94,.65), -2px 0 0 rgba(34,211,238,.65), 6px 6px 16px rgba(0,0,0,.5); animation: pfx-chroma 1.6s steps(2,end) infinite; }
@keyframes pfx-flicker { 0%,100%{opacity:.10} 40%{opacity:.34} 60%{opacity:.16} 80%{opacity:.30} }
.pfx-grain .pfx-overlay, .pfx-noise .pfx-overlay { background-image: repeating-conic-gradient(rgba(255,255,255,.5) 0% 2%, rgba(0,0,0,.5) 0% 4%); background-size: 3px 3px; animation: pfx-flicker .9s steps(3,end) infinite; }
.pfx-vignette .pfx-overlay { background: radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,.85) 100%); }
@keyframes pfx-scan { to { transform: translateY(6px); } }
.pfx-scanlines .pfx-overlay { background: repeating-linear-gradient(rgba(0,0,0,.55) 0 1px, transparent 1px 4px); animation: pfx-scan .6s linear infinite; }
@keyframes pfx-sweep { 0%{transform:translateX(-120%) rotate(18deg)} 100%{transform:translateX(220%) rotate(18deg)} }
.pfx-lightSweep .pfx-overlay, .pfx-spotlight .pfx-overlay { background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent); width: 55%; animation: pfx-sweep 2.6s ease-in-out infinite; }
.pfx-spotlight .pfx-overlay { animation-duration: 4s; filter: blur(6px); }
@keyframes pfx-pixel { 0%,100%{background-size:2px 2px; opacity:.06} 50%{background-size:7px 7px; opacity:.22} }
.pfx-pixelate .pfx-overlay { background: repeating-linear-gradient(45deg, rgba(255,255,255,.6) 0 1px, transparent 1px 2px); animation: pfx-pixel 2s ease-in-out infinite; mix-blend-mode: overlay; }
@keyframes pfx-wobble { 0%,100%{transform:translate(-2px,0) skewX(0)} 50%{transform:translate(3px,-1px) skewX(5deg)} }
.pfx-displacement .pfx-subject { animation: pfx-wobble 1.8s ease-in-out infinite; }
@keyframes pfx-duotone { 0%,100%{opacity:.55} 50%{opacity:.85} }
.pfx-duotone .pfx-overlay { background: linear-gradient(135deg,#8b5cf6,#22d3ee); mix-blend-mode: color; animation: pfx-duotone 3.2s ease-in-out infinite; }
@keyframes pfx-holo { 0%{transform:translateY(-30%)} 100%{transform:translateY(120%)} }
.pfx-hologram .pfx-overlay { background: linear-gradient(180deg, transparent, rgba(34,211,238,.55), rgba(232,121,249,.5), transparent); animation: pfx-holo 2.6s linear infinite; mix-blend-mode: screen; }
.pfx-hologram .pfx-scene, .pfx-hologram .pfx-subject { filter: hue-rotate(160deg) saturate(1.6); }
@keyframes pfx-vhs { 0%,100%{transform:translateY(0)} 25%{transform:translateY(12px)} 50%{transform:translateY(-6px)} 75%{transform:translateY(20px)} }
.pfx-vhs .pfx-overlay { background: repeating-linear-gradient(rgba(0,0,0,.35) 0 2px, transparent 2px 4px); animation: pfx-vhs 1.4s steps(3,end) infinite; }
@keyframes pfx-halftone { 0%,100%{background-size:4px 4px} 50%{background-size:6px 6px} }
.pfx-halftone .pfx-overlay { background-image: radial-gradient(rgba(0,0,0,.85) 30%, transparent 32%); background-size: 5px 5px; animation: pfx-halftone 2.4s ease-in-out infinite; mix-blend-mode: multiply; }
@keyframes pfx-wiggle { 0%,100%{transform:translate(0,0) rotate(0)} 20%{transform:translate(-2px,1px) rotate(-3deg)} 40%{transform:translate(3px,-1px) rotate(3deg)} 60%{transform:translate(-1px,2px) rotate(-2deg)} 80%{transform:translate(2px,0) rotate(2deg)} }
.pfx-wiggle .pfx-subject, .pfx-wiggle .pfx-bar { animation: pfx-wiggle .9s ease-in-out infinite; }
@keyframes pfx-drift { 0%,100%{transform:translate(-4px,0)} 50%{transform:translate(6px,-4px)} }
.pfx-drift .pfx-subject, .pfx-drift .pfx-bar { animation: pfx-drift 3.4s ease-in-out infinite; }
@keyframes pfx-beat { 0%,100%{transform:scale(1)} 18%{transform:scale(1.18)} 36%{transform:scale(1)} 54%{transform:scale(1.1)} 72%{transform:scale(1)} }
.pfx-beatPulse .pfx-subject, .pfx-beatPulse .pfx-bar { animation: pfx-beat 1.5s ease-in-out infinite; }
`;

const FX_CLASS: Partial<Record<EffectType, string>> = {
  blur: 'pfx-blur', glow: 'pfx-glow', bloom: 'pfx-bloom', shadow: 'pfx-shadow', dropShadow: 'pfx-shadow',
  brightness: 'pfx-brightness', contrast: 'pfx-contrast', saturate: 'pfx-saturate', hue: 'pfx-hue',
  grayscale: 'pfx-gray', sepia: 'pfx-sepia', invert: 'pfx-invert', chromatic: 'pfx-chromatic',
  grain: 'pfx-grain', noise: 'pfx-grain', vignette: 'pfx-vignette', scanlines: 'pfx-scanlines',
  lightSweep: 'pfx-lightSweep', pixelate: 'pfx-pixelate', displacement: 'pfx-displacement',
  duotone: 'pfx-duotone', hologram: 'pfx-hologram', vhs: 'pfx-vhs', halftone: 'pfx-halftone',
  spotlight: 'pfx-spotlight', thermal: 'pfx-thermal', posterize: 'pfx-posterize',
  wiggle: 'pfx-wiggle', drift: 'pfx-drift', beatPulse: 'pfx-beatPulse',
};

export function EffectThumb({ type }: { type: EffectType }) {
  return (
    <div className={cn('pfx-thumb aspect-[4/3] w-full', FX_CLASS[type])}>
      <style>{FX_CSS}</style>
      <div className="pfx-scene" />
      <div className="pfx-subject" />
      <div className="pfx-bar" />
      <div className="pfx-overlay" />
      <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.05]" />
    </div>
  );
}

export { ANIMATION_PRESETS, applyPresetToLayer };
