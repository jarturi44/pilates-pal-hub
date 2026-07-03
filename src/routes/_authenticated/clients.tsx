import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PagePrimitives";
import { Search, AlertCircle, Mail, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendTransactionalEmail } from "@/lib/email/send";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsRoute,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ClientsRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (pathname !== "/clients") return <Outlet />;

  return <ClientsPage />;
}

function ClientsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [slotFilter, setSlotFilter] = useState<string>("all");
  const [onbFilter, setOnbFilter] = useState<string>("all");
  const [fulFilter, setFulFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-clients-v2"],
    queryFn: async () => {
      const [users, subs, slots, cs, fulfill, attendance, completions, onbProg] = await Promise.all([
        supabase.from("users").select("id, email, name, needs_slot_assignment, onboarding_complete, created_at, intake_paid_at, intake_completed_at").eq("role", "client").order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("user_id, status, plan:plans(id, display_name, type, sessions_per_week, includes_mornings)").order("created_at", { ascending: false }),
        supabase.from("slots").select("id, day_of_week, time, session_type"),
        supabase.from("client_slots").select("user_id, slot_id"),
        supabase.from("equipment_fulfillment").select("user_id, status"),
        supabase.from("attendance").select("user_id, session_date").order("session_date", { ascending: false }),
        supabase.from("content_completions").select("user_id, completed_at").order("completed_at", { ascending: false }),
        supabase.from("onboarding_progress").select("user_id, waiver_completed_at, shipping_completed_at"),
      ]);
      const subBy = new Map<string, any>();
      (subs.data ?? []).forEach((s: any) => { if (!subBy.has(s.user_id)) subBy.set(s.user_id, s); });
      const slotBy = new Map((slots.data ?? []).map((s: any) => [s.id, s]));
      const csBy = new Map<string, any[]>();
      (cs.data ?? []).forEach((r: any) => {
        const a = csBy.get(r.user_id) ?? []; a.push(slotBy.get(r.slot_id)); csBy.set(r.user_id, a);
      });
      const fulBy = new Map<string, string>();
      (fulfill.data ?? []).forEach((f: any) => fulBy.set(f.user_id, f.status));
      const onbBy = new Map<string, { waiver: boolean; shipping: boolean }>();
      (onbProg.data ?? []).forEach((o: any) => onbBy.set(o.user_id, { waiver: !!o.waiver_completed_at, shipping: !!o.shipping_completed_at }));
      const lastActiveBy = new Map<string, string>();
      (attendance.data ?? []).forEach((a: any) => { if (!lastActiveBy.has(a.user_id)) lastActiveBy.set(a.user_id, a.session_date); });
      (completions.data ?? []).forEach((c: any) => {
        const cur = lastActiveBy.get(c.user_id);
        if (!cur || new Date(c.completed_at) > new Date(cur)) lastActiveBy.set(c.user_id, c.completed_at);
      });
      return { users: users.data ?? [], subBy, csBy, fulBy, onbBy, lastActiveBy };
    },
  });

  const planOptions = useMemo(() => {
    const set = new Set<string>();
    (data?.users ?? []).forEach((u: any) => { const s = data?.subBy.get(u.id); if (s?.plan?.display_name) set.add(s.plan.display_name); });
    return Array.from(set).sort();
  }, [data]);
  const slotOptions = useMemo(() => {
    const set = new Map<string, string>();
    (data?.users ?? []).forEach((u: any) => {
      (data?.csBy.get(u.id) ?? []).forEach((s: any) => { if (s) set.set(s.id, `${DAYS[s.day_of_week]} ${s.time.slice(0,5)}`); });
    });
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const rows = useMemo(() => {
    const list = data?.users ?? [];
    return list.filter((u: any) => {
      const sub = data?.subBy.get(u.id);
      const slots = data?.csBy.get(u.id) ?? [];
      const ful = data?.fulBy.get(u.id);
      if (q && !((u.name ?? "").toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()))) return false;
      if (planFilter !== "all" && sub?.plan?.display_name !== planFilter) return false;
      if (statusFilter !== "all" && (sub?.status ?? "none") !== statusFilter) return false;
      if (slotFilter !== "all" && !slots.some((s: any) => s?.id === slotFilter)) return false;
      const onb = data?.onbBy.get(u.id);
      const fullyComplete = !!u.onboarding_complete && !!onb?.waiver && !!onb?.shipping;
      if (onbFilter === "complete" && !fullyComplete) return false;
      if (onbFilter === "incomplete" && fullyComplete) return false;
      if (fulFilter !== "all" && (ful ?? "n/a") !== fulFilter) return false;
      return true;
    });
  }, [data, q, planFilter, statusFilter, slotFilter, onbFilter, fulFilter]);

  return (
    <>
      <PageHeader title="Clients" subtitle="Search, filter, and manage clients." />

      <PendingIntakesSection />



      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email…"
            className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select label="Plan" value={planFilter} onChange={setPlanFilter} options={[{ v: "all", l: "All plans" }, ...planOptions.map((p) => ({ v: p, l: p }))]} />
          <Select label="Status" value={statusFilter} onChange={setStatusFilter} options={[
            { v: "all", l: "All statuses" }, { v: "active", l: "Active" }, { v: "trialing", l: "Trialing" }, { v: "past_due", l: "Past due" }, { v: "canceled", l: "Canceled" }, { v: "none", l: "No subscription" },
          ]} />
          <Select label="Slot" value={slotFilter} onChange={setSlotFilter} options={[{ v: "all", l: "Any slot" }, ...slotOptions.map(([id, label]) => ({ v: id, l: label }))]} />
          <Select label="Onboarding" value={onbFilter} onChange={setOnbFilter} options={[{ v: "all", l: "All" }, { v: "complete", l: "Complete" }, { v: "incomplete", l: "Incomplete" }]} />
          <Select label="Fulfillment" value={fulFilter} onChange={setFulFilter} options={[{ v: "all", l: "All" }, { v: "pending", l: "Pending" }, { v: "shipped", l: "Shipped" }, { v: "n/a", l: "N/A" }]} />
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground rounded-xl border border-border bg-card p-6">No clients match.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Slot(s)</th>
                <th className="px-4 py-3">Onb</th>
                <th className="px-4 py-3">Ful</th>
                <th className="px-4 py-3">Member since</th>
                <th className="px-4 py-3">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((u: any) => {
                const sub = data!.subBy.get(u.id);
                const slots = (data!.csBy.get(u.id) ?? []).filter(Boolean);
                const ful = data!.fulBy.get(u.id);
                const last = data!.lastActiveBy.get(u.id);
                return (
                  <tr key={u.id} onClick={() => navigate({ to: "/clients/$clientId", params: { clientId: u.id } })} className="hover:bg-muted/30 cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground inline-flex items-center gap-2 flex-wrap">
                        {u.name || u.email}
                        {u.needs_slot_assignment && <AlertCircle size={12} className="text-primary" />}
                        {u.intake_paid_at && !u.intake_completed_at && (
                          <MarkIntakeCompleteButton userId={u.id} email={u.email} name={u.name} />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {sub?.plan?.display_name ?? "—"}
                      {sub?.plan?.sessions_per_week && <div className="text-[10px] text-muted-foreground">{sub.plan.sessions_per_week}/wk</div>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={sub?.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {slots.length === 0 ? "—" : slots.map((s: any) => `${DAYS[s.day_of_week]} ${s.time.slice(0,5)}`).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-xs">{u.onboarding_complete ? <span className="text-primary">Complete</span> : <span className="text-amber-600">Incomplete</span>}</td>
                    <td className="px-4 py-3 text-xs capitalize">{ful ?? "n/a"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{last ? new Date(last).toLocaleDateString() : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = status === "active" || status === "trialing"
    ? "bg-primary/10 text-primary"
    : status === "past_due"
    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
    : "bg-muted text-muted-foreground";
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", cls)}>{status}</span>;
}

type PendingIntake = {
  id: string;
  email: string;
  name: string | null;
  paid_at: string;
  intake_completed_at: string | null;
  resume_token: string;
  resume_email_sent_at: string | null;
};

function PendingIntakesSection() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: pending } = useQuery({
    queryKey: ["admin-pending-intakes"],
    queryFn: async (): Promise<PendingIntake[]> => {
      const { data, error } = await supabase
        .from("pending_intakes")
        .select("id, email, name, paid_at, intake_completed_at, resume_token, resume_email_sent_at")
        .is("claimed_by_user_id", null)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PendingIntake[];
    },
  });

  if (!pending || pending.length === 0) return null;

  async function markIntakeComplete(row: PendingIntake) {
    setBusyId(row.id);
    try {
      const { error } = await supabase
        .from("pending_intakes")
        .update({ intake_completed_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Marked intake complete.");
      qc.invalidateQueries({ queryKey: ["admin-pending-intakes"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function sendFinishSignupEmail(row: PendingIntake) {
    setBusyId(row.id);
    try {
      await sendTransactionalEmail({
        templateName: "intake-finish-signup",
        recipientEmail: row.email,
        idempotencyKey: `intake-finish-${row.id}-${row.resume_email_sent_at ? Date.now() : "first"}`,
        templateData: { name: row.name ?? undefined, resumeToken: row.resume_token },
      });
      await supabase
        .from("pending_intakes")
        .update({ resume_email_sent_at: new Date().toISOString() })
        .eq("id", row.id);
      toast.success("Email sent.");
      qc.invalidateQueries({ queryKey: ["admin-pending-intakes"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle size={14} className="text-amber-600" />
        <h2 className="text-sm font-semibold text-foreground">
          Paid intakes — awaiting account creation ({pending.length})
        </h2>
      </div>
      <ul className="divide-y divide-amber-500/20">
        {pending.map((p) => (
          <li key={p.id} className="py-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="text-sm font-medium text-foreground">{p.name || p.email}</div>
              <div className="text-xs text-muted-foreground">
                {p.email} · paid {new Date(p.paid_at).toLocaleDateString()}
                {p.intake_completed_at && (
                  <span className="ml-2 inline-flex items-center gap-1 text-primary">
                    <CheckCircle2 size={11} /> intake done
                  </span>
                )}
                {p.resume_email_sent_at && (
                  <span className="ml-2 text-muted-foreground">
                    · reminder sent {new Date(p.resume_email_sent_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            {!p.intake_completed_at && (
              <button
                onClick={() => markIntakeComplete(p)}
                disabled={busyId === p.id}
                className="text-xs rounded-md border border-border bg-background px-3 py-1.5 hover:bg-secondary disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {busyId === p.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Mark intake complete
              </button>
            )}
            <button
              onClick={() => sendFinishSignupEmail(p)}
              disabled={busyId === p.id}
              className="text-xs rounded-md bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {busyId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
              {p.resume_email_sent_at ? "Resend finish-setup email" : "Send finish-setup email"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MarkIntakeCompleteButton({ userId, email, name }: { userId: string; email: string; name: string | null }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function markComplete(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    const { error } = await supabase
      .from("users")
      .update({ intake_completed_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) { setBusy(false); return toast.error(error.message); }
    try {
      await sendTransactionalEmail({
        templateName: "intake-complete",
        recipientEmail: email,
        idempotencyKey: `intake-complete-${userId}`,
        templateData: { name: name ?? undefined, loginUrl: `${window.location.origin}/login` },
      });
      toast.success("Intake marked complete — email sent.");
    } catch {
      toast.success("Intake marked complete (email failed).");
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["admin-clients-v2"] });
  }
  return (
    <button
      onClick={markComplete}
      disabled={busy}
      className="text-[10px] rounded-md border border-primary/40 bg-primary/10 text-primary px-2 py-0.5 hover:bg-primary/20 disabled:opacity-50 inline-flex items-center gap-1"
      title="Mark intake session complete"
    >
      {busy ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
      Mark intake complete
    </button>
  );
}
