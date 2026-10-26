'use client';
import * as React from 'react';
import type { Project } from '@/lib/engine/types';
import { drawScene, preloadImage } from '@/lib/engine/renderer';
import { cn } from '@/lib/utils';

export interface SceneCanvasProps {
  project: Pick<Project, 'layers' | 'width' | 'height' | 'background' | 'backgroundGradient'> & { duration?: number };
  time?: number;
  playing?: boolean;
  fit?: 'contain' | 'cover';
  className?: string;
  background?: string;
  quality?: number;
  ariaLabel?: string;
}

/** Lightweight canvas renderer for thumbnails, previews, landing page and export. */
export function SceneCanvas({ project, time = 0, playing = false, fit = 'contain', className, background, quality = 1, ariaLabel }: SceneCanvasProps) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const raf = React.useRef<number>(0);
  const startRef = React.useRef<number>(0);
  const timeRef = React.useRef(time);
  const [ready, setReady] = React.useState(false);
  const renderRef = React.useRef<((t: number) => void) | null>(null);

  React.useEffect(() => { timeRef.current = time; }, [time]);

  React.useEffect(() => {
    project.layers.forEach((l) => {
      if (l.media?.src) preloadImage(l.media.src);
      if (l.cutout?.src) preloadImage(l.cutout.src, () => renderRef.current?.(timeRef.current));
    });
  }, [project.layers]);

  React.useEffect(() => {
    const el = wrapRef.current;
    const canvas = ref.current;
    if (!el || !canvas) return;
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

    const render = (t: number) => {
      const cw = el.clientWidth, ch = el.clientHeight;
      if (!cw || !ch) return;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      const scale = fit === 'cover'
        ? Math.max(cw / project.width, ch / project.height)
        : Math.min(cw / project.width, ch / project.height);
      const ox = (cw - project.width * scale) / 2;
      const oy = (ch - project.height * scale) / 2;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
      drawScene(ctx, project as Project, t, { quality });
      if (!ready) setReady(true);
    };

    const loopFn = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const duration = Math.max(0.1, (project as Project).duration || 8);
      const elapsed = ((now - startRef.current) / 1000) % duration;
      render(elapsed);
      raf.current = requestAnimationFrame(loopFn);
    };

    if (playing) {
      startRef.current = 0;
      raf.current = requestAnimationFrame(loopFn);
    } else {
      render(timeRef.current);
    }
    const ro = new ResizeObserver(() => render(playing ? 0 : timeRef.current));
    ro.observe(el);
    renderRef.current = render;
    return () => {
      cancelAnimationFrame(raf.current);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, playing, fit, quality, background]);

  // Scrubbing: repaint whenever the caller drives `time` while paused.
  React.useEffect(() => {
    if (!playing) renderRef.current?.(time);
  }, [time, playing]);

  return (
    <div ref={wrapRef} className={cn('relative h-full w-full', className)}>
      <canvas ref={ref} aria-label={ariaLabel ?? 'Scene preview'} role="img" className="h-full w-full" data-ready={ready} />
    </div>
  );
}
