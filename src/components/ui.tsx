"use client";
import React from "react";
import { cn } from "@/lib/utils";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "subtle";
  size?: "sm" | "md" | "lg" | "icon";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap",
        size === "sm" && "h-7 px-2.5 text-xs",
        size === "md" && "h-9 px-3.5 text-sm",
        size === "lg" && "h-11 px-5 text-sm",
        size === "icon" && "h-8 w-8 p-0",
        variant === "primary" && "text-white shadow-glow hover:brightness-110 active:scale-[.98] bg-gradient-to-r from-violet-600 via-violet-500 to-fuchsia-500",
        variant === "ghost" && "text-zinc-300 hover:bg-white/[.07] hover:text-white",
        variant === "outline" && "border border-white/15 text-zinc-200 hover:bg-white/[.06] hover:border-white/25",
        variant === "subtle" && "bg-white/[.06] text-zinc-200 hover:bg-white/[.1]",
        variant === "danger" && "bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30",
        className,
      )}
      {...props}
    />
  );
}

export function IconBtn({
  active,
  title,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      title={title}
      aria-label={title}
      className={cn(
        "relative flex items-center justify-center h-9 w-9 rounded-lg transition-all",
        active ? "text-white bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-glow" : "text-zinc-400 hover:text-white hover:bg-white/[.08]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full h-8 rounded-lg bg-white/[.05] border border-white/10 px-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 hover:border-white/20 focus:border-violet-400/60 outline-none transition-colors";

export function NumberField({
  label, value, onChange, step = 1, min, max, suffix,
}: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <input
          type="number" value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0} step={step} min={min} max={max}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={inputCls}
        />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">{suffix}</span>}
      </div>
    </Field>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#7c3aed";
  return (
    <Field label={label}>
      <div className="flex items-center gap-1.5">
        <input type="color" value={safe} onChange={(e) => onChange(e.target.value)} className="h-8 w-9 shrink-0 rounded-lg" aria-label={label} />
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "font-mono text-[11px]")} spellCheck={false} />
      </div>
    </Field>
  );
}

export function SliderField({
  label, value, onChange, min, max, step = 0.01, format,
}: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => string;
}) {
  return (
    <Field label={`${label} · ${format ? format(value) : Math.round(value * 100) / 100}`}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
    </Field>
  );
}

export function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "appearance-none cursor-pointer [&>option]:bg-ink-800")}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch" aria-checked={checked} aria-label={label} title={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 rounded-full transition-colors shrink-0", checked ? "bg-violet-600" : "bg-white/15")}
    >
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", checked ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

export function SectionTitle({ icon, children, right }: { icon?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
      <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-zinc-500">
        {icon}
        {children}
      </h3>
      {right}
    </div>
  );
}

export function Badge({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "green" | "violet" | "cyan" | "amber" | "red" }) {
  const tones: Record<string, string> = {
    zinc: "bg-white/[.07] text-zinc-300 border-white/10",
    green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    red: "bg-red-500/15 text-red-300 border-red-500/30",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", tones[tone])}>{children}</span>;
}

export function PrismLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <linearGradient id="prism-g" x1="0" y1="0" x2="48" y2="48">
          <stop stopColor="#7c3aed" /><stop offset=".5" stopColor="#06b6d4" /><stop offset="1" stopColor="#d946ef" />
        </linearGradient>
      </defs>
      <path d="M24 4 L44 40 L4 40 Z" stroke="url(#prism-g)" strokeWidth="4" strokeLinejoin="round" fill="rgba(124,58,237,.12)" />
      <path d="M10 26 H24 M24 26 L38 18 M24 26 L36 30" stroke="url(#prism-g)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin h-4 w-4", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10v4a6 6 0 0 1 6 6h4z" fill="currentColor" />
    </svg>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative glass rounded-2xl shadow-pop w-full animate-rise max-h-[88vh] flex flex-col", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[.07]">
          <h2 className="font-display font-semibold text-[15px]">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-lg leading-none px-1" aria-label="Close">✕</button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
