import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PagePrimitives";
import { toast } from "sonner";
import { AlertCircle, Check, Download, FileText, Loader2, X } from "lucide-react";
import jsPDF from "jspdf";
import { cn } from "@/lib/utils";
import { ProgressDashboard } from "@/components/ProgressDashboard";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
});

type ClientRow = {
  id: string;
  email: string;
  name: string | null;
  needs_slot_assignment: boolean;
  onboarding_complete: boolean;
  created_at: string;
};

function ClientsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "needs_slot">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, name, needs_slot_assignment, onboarding_complete, created_at")
        .eq("role", "client")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ClientRow[];
    },
  });

  const filtered = useMemo(() => {
    const list = clients ?? [];
    return filter === "needs_slot" ? list.filter((c) => c.needs_slot_assignment) : list;
  }, [clients, filter]);

  const needsSlotCount = (clients ?? []).filter((c) => c.needs_slot_assignment).length;

  async function dismissFlag(userId: string) {
    const { error } = await supabase
      .from("users").update({ needs_slot_assignment: false }).eq("id", userId);
    if (error) return toast.error(error.message);
    toast.success("Flag cleared");
    qc.invalidateQueries({ queryKey: ["admin-clients"] });
  }

  return (
    <>
      <PageHeader title="Clients" subtitle="Manage clients, intake, waivers, and slot assignments." />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs",
            filter === "all" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >All clients</button>
        <button
          onClick={() => setFilter("needs_slot")}
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs inline-flex items-center gap-1.5",
            filter === "needs_slot" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <AlertCircle size={12} />
          Needs slot assignment
          {needsSlotCount > 0 && (
            <span className="rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5">
              {needsSlotCount}
            </span>
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground rounded-xl border border-border bg-card p-6">No clients to show.</div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {filtered.map((c) => (
            <div key={c.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium text-foreground truncate">{c.name || c.email}</div>
                  {c.needs_slot_assignment && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide">
                      <AlertCircle size={10} /> New — needs slot
                    </span>
                  )}
                  {!c.onboarding_complete && (
                    <span className="rounded-full bg-muted text-muted-foreground text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide">
                      Onboarding pending
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.email}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.needs_slot_assignment && (
                  <button
                    onClick={() => dismissFlag(c.id)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted inline-flex items-center gap-1"
                    title="Dismiss flag after assigning slot"
                  >
                    <X size={12} /> Dismiss
                  </button>
                )}
                <button
                  onClick={() => setSelectedId(c.id)}
                  className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs hover:opacity-90"
                >View</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedId && (
        <ClientDetailDrawer
          clientId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}

function ClientDetailDrawer({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-client-detail", clientId],
    queryFn: async () => {
      const [user, intake, waiver, sub, completions, attendance, slots] = await Promise.all([
        supabase.from("users").select("*").eq("id", clientId).maybeSingle(),
        supabase.from("intake_forms").select("*").eq("user_id", clientId)
          .order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("waivers").select("*").eq("user_id", clientId)
          .order("signed_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("subscriptions").select("*, plan:plans(*)").eq("user_id", clientId)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("content_completions").select("completed_at").eq("user_id", clientId)
          .order("completed_at", { ascending: false }),
        supabase.from("attendance").select("id, slot_id, session_date, status, attended, notes")
          .eq("user_id", clientId).order("session_date", { ascending: false }),
        supabase.from("slots").select("id, day_of_week, time, session_type"),
      ]);
      return {
        user: user.data, intake: intake.data, waiver: waiver.data, sub: sub.data,
        completions: (completions.data ?? []) as { completed_at: string }[],
        attendance: (attendance.data ?? []) as { id: string; slot_id: string; session_date: string; status: string; attended: boolean; notes: string | null }[],
        slots: (slots.data ?? []) as { id: string; day_of_week: number; time: string; session_type: string }[],
      };
    },
  });


  function exportWaiverPdf() {
    if (!data?.waiver || !data.user) return toast.error("No waiver on file");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 54;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableWidth = pageWidth - margin * 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Liability Waiver", margin, margin);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let y = margin + 28;
    const meta = [
      `Client: ${data.user.name || data.user.email}`,
      `Email: ${data.user.email}`,
      `Signed at: ${new Date(data.waiver.signed_at).toLocaleString()}`,
      `IP address: ${data.waiver.ip_address ?? "n/a"}`,
    ];
    meta.forEach((line) => { doc.text(line, margin, y); y += 14; });

    y += 8;
    doc.setDrawColor(180); doc.line(margin, y, pageWidth - margin, y); y += 16;

    doc.setFontSize(11);
    const lines = doc.splitTextToSize(data.waiver.content_snapshot, usableWidth);
    lines.forEach((ln: string) => {
      if (y > pageHeight - margin) { doc.addPage(); y = margin; }
      doc.text(ln, margin, y); y += 14;
    });

    const safeName = (data.user.name || data.user.email).replace(/[^a-z0-9]+/gi, "_");
    doc.save(`waiver_${safeName}.pdf`);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-xl bg-background border-l border-border h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-foreground">Client details</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        {isLoading || !data ? (
          <div className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>
        ) : (
          <div className="space-y-6">
            <section>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Account</div>
              <div className="font-medium text-foreground">{data.user?.name || data.user?.email}</div>
              <div className="text-sm text-muted-foreground">{data.user?.email}</div>
            </section>

            {data.sub && (
              <section className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Subscription</div>
                <div className="font-medium text-foreground">{(data.sub.plan as any)?.display_name}</div>
                <div className="text-xs text-muted-foreground capitalize">Status: {data.sub.status}</div>
              </section>
            )}

            <section>
              <h3 className="font-display text-lg text-foreground mb-3">Progress</h3>
              <ProgressDashboard userId={clientId} />
            </section>

            <AttendanceSection
              records={data.attendance}
              slots={data.slots}
            />

            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={14} className="text-muted-foreground" />
                <h3 className="font-display text-lg text-foreground">Intake form</h3>
              </div>
              {!data.intake ? (
                <p className="text-sm text-muted-foreground">Not submitted yet.</p>
              ) : (
                <dl className="text-sm space-y-1.5 text-foreground">
                  <Row k="Fitness level" v={data.intake.fitness_level} />
                  <Row k="Primary goal" v={data.intake.primary_goal} />
                  <Row k="Days per week" v={data.intake.days_per_week?.toString()} />
                  <Row k="Injuries" v={data.intake.injuries} multiline />
                  <Row k="How they heard about us" v={data.intake.referral_source} />
                  <Row k="Submitted" v={new Date(data.intake.submitted_at).toLocaleString()} />
                </dl>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-muted-foreground" />
                  <h3 className="font-display text-lg text-foreground">Signed waiver</h3>
                </div>
                {data.waiver && (
                  <button
                    onClick={exportWaiverPdf}
                    className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted inline-flex items-center gap-1"
                  >
                    <Download size={12} /> Export PDF
                  </button>
                )}
              </div>
              {!data.waiver ? (
                <p className="text-sm text-muted-foreground">Not signed yet.</p>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Signed {new Date(data.waiver.signed_at).toLocaleString()}
                    {data.waiver.ip_address && ` · IP ${data.waiver.ip_address}`}
                  </div>
                  <div className="rounded-md border border-border bg-background p-3 max-h-64 overflow-y-auto text-xs whitespace-pre-line text-foreground">
                    {data.waiver.content_snapshot}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ k, v, multiline }: { k: string; v: string | null | undefined; multiline?: boolean }) {
  return (
    <div className={cn("grid gap-0.5", multiline ? "" : "grid-cols-[1fr_auto] items-baseline")}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className={cn("text-sm text-foreground", multiline && "whitespace-pre-line")}>{v || "—"}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-display text-xl text-foreground mt-0.5">{value}</div>
    </div>
  );
}
