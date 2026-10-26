import type { Track } from '@/lib/data/library';

// ── Waveform peaks ───────────────────────────────────────────────────────────
const peaksCache = new Map<string, number[]>();

export function proceduralPeaks(seed: string, buckets = 96): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rnd = () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out: number[] = [];
  for (let i = 0; i < buckets; i++) {
    const env = 0.35 + 0.65 * Math.abs(Math.sin((i / buckets) * Math.PI * 3 + 0.6));
    out.push(Math.max(0.05, Math.min(1, env * (0.35 + rnd() * 0.8))));
  }
  return out;
}

export async function decodePeaks(src: string, buckets = 140): Promise<number[]> {
  const cacheKey = `${src.slice(0, 64)}:${buckets}`;
  const cached = peaksCache.get(cacheKey);
  if (cached) return cached;
  try {
    const res = await fetch(src);
    const buf = await res.arrayBuffer();
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    const audio = await ctx.decodeAudioData(buf);
    const data = audio.getChannelData(0);
    const block = Math.floor(data.length / buckets) || 1;
    const peaks: number[] = [];
    for (let i = 0; i < buckets; i++) {
      let max = 0;
      for (let j = 0; j < block; j += 16) max = Math.max(max, Math.abs(data[i * block + j] ?? 0));
      peaks.push(max);
    }
    await ctx.close();
    peaksCache.set(cacheKey, peaks);
    return peaks;
  } catch {
    const p = proceduralPeaks(src, buckets);
    peaksCache.set(cacheKey, p);
    return p;
  }
}

// ── Procedural music / SFX synthesis (royalty-free by construction) ─────────
export class SynthPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  private ensure() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const n of this.nodes) { try { n.stop(); } catch { /* already stopped */ } }
    this.nodes = [];
  }

  playMusic(track: Track, seconds = 12) {
    this.stop();
    const ctx = this.ensure();
    const master = this.master!;
    const beat = 60 / Math.max(40, track.bpm);
    const steps = Math.floor(seconds / (beat / 2));
    const midi = (semi: number) => track.root * Math.pow(2, semi / 12);
    for (let i = 0; i < steps; i++) {
      const when = ctx.currentTime + 0.06 + i * (beat / 2);
      const note = track.scale[(track.pattern?.[i % (track.pattern.length || 1)] ?? 0) % (track.scale.length || 1)] ?? 0;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = track.waveform ?? 'sine';
      osc.frequency.setValueAtTime(midi(note + 12), when);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.5, when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + (beat / 2) * 1.7);
      osc.connect(gain).connect(master);
      osc.start(when); osc.stop(when + (beat / 2) * 1.8);
      this.nodes.push(osc);
      if (i % 4 === 0) {
        const bass = ctx.createOscillator();
        const bg = ctx.createGain();
        bass.type = 'sine';
        bass.frequency.setValueAtTime(midi(note) / 2, when);
        bg.gain.setValueAtTime(0.0001, when);
        bg.gain.exponentialRampToValueAtTime(0.55, when + 0.03);
        bg.gain.exponentialRampToValueAtTime(0.0001, when + beat * 1.4);
        bass.connect(bg).connect(master);
        bass.start(when); bass.stop(when + beat * 1.5);
        this.nodes.push(bass);
      }
    }
    this.timer = setTimeout(() => this.stop(), seconds * 1000 + 400);
  }

  playSfx(track: Track) {
    this.stop();
    const ctx = this.ensure();
    const master = this.master!;
    const t0 = ctx.currentTime + 0.02;
    if (track.id.includes('whoosh') || track.id.includes('riser') || track.id.includes('shimmer')) {
      const bufferSize = Math.floor(ctx.sampleRate * track.duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (i / bufferSize);
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, t0);
      filter.frequency.exponentialRampToValueAtTime(4800, t0 + track.duration);
      filter.Q.value = 1.2;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.8, t0 + track.duration * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + track.duration);
      noise.connect(filter).connect(gain).connect(master);
      noise.start(t0); noise.stop(t0 + track.duration);
      this.nodes.push(noise);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = track.id.includes('impact') ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(track.root * 2, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, track.root / 4), t0 + track.duration);
      gain.gain.setValueAtTime(0.9, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + track.duration);
      osc.connect(gain).connect(master);
      osc.start(t0); osc.stop(t0 + track.duration);
      this.nodes.push(osc);
    }
    this.timer = setTimeout(() => this.stop(), track.duration * 1000 + 200);
  }
}

export const synth = typeof window !== 'undefined' ? new SynthPlayer() : null;

export function formatAudioTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
