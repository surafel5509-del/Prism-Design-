import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors whitespace-nowrap', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary/12 text-primary',
      secondary: 'border-border bg-secondary text-secondary-foreground',
      outline: 'border-border text-foreground',
      success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500',
      warning: 'border-amber-500/25 bg-amber-500/10 text-amber-500',
      danger: 'border-red-500/25 bg-red-500/10 text-red-500',
      prism: 'border-transparent text-white bg-[linear-gradient(110deg,#7c3aed,#0891b2_55%,#c026d3)]',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
