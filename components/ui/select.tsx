'use client';
import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  containerClassName?: string;
}
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, containerClassName, children, ...props }, ref) => (
  <div className={cn('relative', containerClassName)}>
    <select
      ref={ref}
      className={cn(
        'h-8 w-full appearance-none rounded-md border border-input bg-background/40 pl-2.5 pr-7 text-xs transition-colors focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/15 disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
  </div>
));
Select.displayName = 'Select';
