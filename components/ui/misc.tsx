'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted/70', className)} {...props} />;
}

export function Kbd({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd className={cn('pointer-events-none inline-flex h-[18px] min-w-[18px] select-none items-center justify-center gap-0.5 rounded border border-border bg-muted/60 px-1 font-mono text-[9.5px] font-medium text-muted-foreground', className)} {...props}>
      {children}
    </kbd>
  );
}

export function Progress({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full bg-[linear-gradient(90deg,#8b5cf6,#22d3ee,#e879f9)] transition-[width] duration-300 ease-out', barClassName)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className, size = 'sm' }: {
  value: T; onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  className?: string; size?: 'xs' | 'sm';
}) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[6px] font-medium transition-all duration-150 whitespace-nowrap',
            size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]',
            value === o.value ? 'bg-background text-foreground shadow-sm ring-1 ring-border/70' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
      {icon && <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">{icon}</div>}
      <p className="text-xs font-medium text-foreground">{title}</p>
      {description && <p className="max-w-[220px] text-[11px] leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Dot({ className }: { className?: string }) {
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full', className)} />;
}
