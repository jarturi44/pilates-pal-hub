import { cn } from "@/lib/utils";

export const STUDIO_NAME = "Pilates with Jon";

export function Wordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
    xl: "text-3xl",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-2 font-display tracking-tight", sizes[size], className)}>
      <span
        aria-hidden
        className="inline-block h-6 w-6 rounded-md bg-primary text-primary-foreground text-[11px] font-bold leading-6 text-center"
      >
        PJ
      </span>
      <span className="font-semibold">Pilates with Jon</span>
    </span>
  );
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <Wordmark size="lg" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
