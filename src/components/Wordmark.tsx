import { cn } from "@/lib/utils";
import logoUrl from "@/assets/logo.png";

export const STUDIO_NAME = "Pilates with Jon";
export const LOGO_URL = logoUrl;

const sizeMap = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
} as const;

export function Wordmark({
  className,
  size = "md",
  showText = false,
}: {
  className?: string;
  size?: keyof typeof sizeMap;
  showText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <img
        src={logoUrl}
        alt="Pilates with Jon"
        className={cn(sizeMap[size], "rounded-md object-contain")}
      />
      {showText && (
        <span className="font-display font-semibold tracking-tight text-base">
          Pilates with Jon
        </span>
      )}
    </span>
  );
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <Wordmark size="xl" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
