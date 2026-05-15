import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl text-foreground">{title}</h1>
        {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0 pt-1">{right}</div>}
    </div>
  );
}

export function ComingSoon({ label, children }: { label?: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">{label ?? "Coming soon"}</p>
      {children}
    </div>
  );
}
