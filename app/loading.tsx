import { PrismLogo } from '@/components/brand/PrismLogo';

export default function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="relative grid h-12 w-12 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/20" />
          <PrismLogo className="relative h-8 w-8" />
        </div>
        <p className="text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">Prism</p>
      </div>
    </div>
  );
}
