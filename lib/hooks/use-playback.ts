'use client';
import { useEffect, useRef } from 'react';
import { useEditor } from '@/lib/store/editor';
import { synth } from '@/lib/engine/audio';
import { MUSIC } from '@/lib/data/library';
import { setVideosPlaying } from '@/lib/engine/renderer';

/**
 * Real playback clock: advances the timeline at the project speed, honours loop
 * modes, and keeps imported audio, synthesized music beds and video elements in
 * sync with the canvas.
 */
export function usePlayback() {
  const playing = useEditor((s) => s.playing);
  const audios = useRef(new Map<string, HTMLAudioElement>());
  const direction = useRef(1);
  const lastTs = useRef(0);
  const lastSynthSrc = useRef<string | null>(null);

  useEffect(() => {
    if (!playing) {
      audios.current.forEach((el) => el.pause());
      synth?.stop();
      lastSynthSrc.current = null;
      setVideosPlaying(false);
      return;
    }

    const state = useEditor.getState();
    direction.current = 1;
    lastTs.current = performance.now();
    setVideosPlaying(true);

    // start synthesized music beds
    const musicLayer = state.project.layers.find((l) => l.type === 'audio' && (l.media?.src ?? '').startsWith('synth:'));
    if (musicLayer && synth) {
      const trackId = (musicLayer.media?.src ?? '').replace('synth:', '');
      const track = MUSIC.find((t) => t.id === trackId);
      if (track && lastSynthSrc.current !== track.id) {
        synth.stop();
        synth.playMusic(track, Math.max(2, state.project.duration - state.time));
        lastSynthSrc.current = track.id;
      }
    }

    let raf = 0;
    const tick = (ts: number) => {
      const s = useEditor.getState();
      if (!s.playing) return;
      const dt = Math.min(0.25, (ts - lastTs.current) / 1000);
      lastTs.current = ts;
      let next = s.time + dt * s.speed * direction.current;
      if (next >= s.project.duration) {
        if (s.loopMode === 'loop') { next = 0; restartAudio(s.project.duration); }
        else if (s.loopMode === 'pingpong') { next = s.project.duration - 0.001; direction.current = -1; }
        else { s.setTime(s.project.duration); s.setPlaying(false); return; }
      }
      if (next <= 0 && direction.current < 0) {
        if (s.loopMode === 'pingpong') { next = 0.001; direction.current = 1; }
        else { s.setTime(0); s.setPlaying(false); return; }
      }
      s.setTime(next);
      syncAudio(s.time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    function restartAudio(from: number) {
      void from;
      lastSynthSrc.current = null;
      audios.current.forEach((el) => { try { el.currentTime = 0; void el.play(); } catch { /* noop */ } });
    }

    function syncAudio(time: number) {
      const layers = useEditor.getState().project.layers.filter((l) => l.type === 'audio' && l.media?.src && !l.media.src.startsWith('synth:'));
      for (const layer of layers) {
        const active = time >= layer.startTime && time <= layer.endTime;
        let el = audios.current.get(layer.id);
        if (!el && layer.media?.src) {
          el = new Audio(layer.media.src);
          el.preload = 'auto';
          el.muted = layer.media?.muted ?? false;
          audios.current.set(layer.id, el);
        }
        if (!el || !layer.media) continue;
        el.volume = Math.max(0, Math.min(1, layer.media.volume ?? 0.8));
        el.loop = layer.media.loop ?? false;
        const local = (layer.media.trimStart ?? 0) + (time - layer.startTime) * (layer.media.playbackRate ?? 1);
        if (!active) { if (!el.paused) el.pause(); continue; }
        if (Math.abs(el.currentTime - local) > 0.3) { try { el.currentTime = Math.max(0, local); } catch { /* noop */ } }
        if (el.paused) el.play().catch(() => undefined);
      }
      for (const [id, el] of audios.current) {
        if (!layers.some((l) => l.id === id)) { el.pause(); audios.current.delete(id); }
      }
    }

    syncAudio(state.time);
    return () => {
      cancelAnimationFrame(raf);
      audios.current.forEach((el) => el.pause());
      synth?.stop();
      lastSynthSrc.current = null;
      setVideosPlaying(false);
    };
  }, [playing]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) useEditor.getState().setPlaying(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
}
