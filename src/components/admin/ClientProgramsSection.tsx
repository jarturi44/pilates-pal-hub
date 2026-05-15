import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ClientProgramsSection({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["client-programs", userId],
    queryFn: async () => {
      const [{ data: assignment }, { data: completions }] = await Promise.all([
        supabase.from("program_assignments")
          .select("assigned_at, program:programs(name)")
          .eq("user_id", userId).eq("active", true).maybeSingle(),
        supabase.from("program_completions")
          .select("completed_at, program:programs(name)")
          .eq("user_id", userId).order("completed_at", { ascending: false }),
      ]);
      return { assignment, completions: completions ?? [] };
    },
  });

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const a: any = data.assignment;
  const last = data.completions[0] as any;

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Current program" value={a?.program?.name ?? "—"} />
        <Stat label="Assigned" value={a?.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : "—"} />
        <Stat label="Sessions logged" value={data.completions.length.toString()} />
        <Stat label="Last session" value={last ? new Date(last.completed_at).toLocaleDateString() : "—"} />
      </div>
      {data.completions.length > 0 && (
        <div className="rounded-md border border-border max-h-56 overflow-y-auto divide-y divide-border">
          {data.completions.map((c: any, i: number) => (
            <div key={i} className="px-3 py-2 text-xs flex items-center justify-between">
              <span className="text-foreground">{c.program?.name ?? "Program"}</span>
              <span className="text-muted-foreground">{new Date(c.completed_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground mt-0.5">{value}</div>
    </div>
  );
}
