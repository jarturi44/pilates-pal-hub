import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PagePrimitives";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type Tab = "general" | "waiver" | "reminders" | "revenue";

function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");
  return (
    <>
      <PageHeader title="Settings" subtitle="Studio configuration." />
      <div className="flex gap-2 border-b border-border mb-6 overflow-x-auto">
        {(["general", "waiver", "reminders", "revenue"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-2 text-sm capitalize border-b-2 -mb-px",
              tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >{t}</button>
        ))}
      </div>
      {tab === "general" && <GeneralTab />}
      {tab === "waiver" && <WaiverTab />}
      {tab === "reminders" && <RemindersTab />}
      {tab === "revenue" && <RevenueTab />}
    </>
  );
}

function GeneralTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["studio-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle();
      return data;
    },
  });
  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (data) setForm(data); }, [data]);

  if (isLoading || !form) return <p className="text-sm text-muted-foreground">Loading…</p>;

  async function save() {
    const { error } = await supabase.from("studio_settings").update({
      studio_name: form.studio_name,
      admin_email: form.admin_email,
      grace_period_days: form.grace_period_days,
      commitment_months: form.commitment_months,
      shop_url: form.shop_url,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["studio-settings"] });
  }

  return (
    <div className="max-w-lg space-y-4">
      <Field label="Studio name">
        <input value={form.studio_name ?? ""} onChange={(e) => setForm({ ...form, studio_name: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </Field>
      <Field label="Admin email">
        <input type="email" value={form.admin_email ?? ""} onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </Field>
      <Field label="Payment grace period (days, 1–7)">
        <input type="number" min={1} max={7} value={form.grace_period_days}
          onChange={(e) => setForm({ ...form, grace_period_days: Math.min(7, Math.max(1, +e.target.value)) })}
          className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </Field>
      <Field label="Commitment period (months)">
        <input type="number" min={1} max={24} value={form.commitment_months}
          onChange={(e) => setForm({ ...form, commitment_months: Math.min(24, Math.max(1, +e.target.value)) })}
          className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </Field>
      <Field label="Printful shop URL">
        <input type="url" value={form.shop_url ?? ""} onChange={(e) => setForm({ ...form, shop_url: e.target.value })}
          placeholder="https://your-store.printful.com"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </Field>
      <button onClick={save} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs">Save changes</button>
    </div>
  );
}

function WaiverTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["waiver-versions"],
    queryFn: async () => {
      const [versions, settings] = await Promise.all([
        supabase.from("waiver_versions").select("*").order("version", { ascending: false }),
        supabase.from("studio_settings").select("current_waiver_version_id").eq("id", 1).maybeSingle(),
      ]);
      return { versions: versions.data ?? [], currentId: settings.data?.current_waiver_version_id as string | null };
    },
  });
  const [draft, setDraft] = useState("");
  const current = data?.versions.find((v: any) => v.id === data.currentId) ?? data?.versions[0];

  useEffect(() => {
    if (current && draft === "") setDraft(current.content);
  }, [current]);

  async function publish() {
    if (!draft.trim()) return toast.error("Waiver text required");
    const nextVersion = (data?.versions[0]?.version ?? 0) + 1;
    const { data: ins, error } = await supabase.from("waiver_versions").insert({
      version: nextVersion, content: draft, created_by: user?.id ?? null,
    }).select("id").single();
    if (error) return toast.error(error.message);
    await supabase.from("studio_settings").update({ current_waiver_version_id: ins.id }).eq("id", 1);
    toast.success(`Published v${nextVersion}`);
    qc.invalidateQueries({ queryKey: ["waiver-versions"] });
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Editing the waiver creates a new version. Previously signed waivers keep their original text snapshot.
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={14}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
        placeholder="Enter waiver text…"
      />
      <button onClick={publish} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs">
        Publish new version
      </button>

      <section>
        <h4 className="font-display text-lg text-foreground mb-2">Version history</h4>
        {!data?.versions.length ? (
          <p className="text-sm text-muted-foreground">No versions yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {data.versions.map((v: any) => (
              <li key={v.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <div className="text-foreground">v{v.version} {v.id === data.currentId && <span className="ml-2 text-[10px] uppercase text-primary">Active</span>}</div>
                  <div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RemindersTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["reminder-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("reminder_settings").select("*").eq("id", 1).maybeSingle();
      return data;
    },
  });
  const [days, setDays] = useState<number[]>([]);
  useEffect(() => { if (data) setDays(data.reminder_days ?? []); }, [data]);
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function toggle(d: number) {
    setDays((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort());
  }
  async function save() {
    const { error } = await supabase.from("reminder_settings").update({
      reminder_days: days, updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["reminder-settings"] });
  }
  return (
    <div className="max-w-lg space-y-4">
      <div className="text-sm text-muted-foreground">Days of the week to send 10 Minute Mornings reminders.</div>
      <div className="flex gap-1.5">
        {labels.map((l, i) => (
          <button key={i} onClick={() => toggle(i)}
            className={cn("rounded-md border px-3 py-2 text-xs",
              days.includes(i) ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            {l}
          </button>
        ))}
      </div>
      <button onClick={save} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs">Save</button>
    </div>
  );
}

function RevenueTab() {
  const { data } = useQuery({
    queryKey: ["revenue-view"],
    queryFn: async () => {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
      const [active, canceled] = await Promise.all([
        supabase.from("subscriptions").select("plan_id, plan:plans(display_name, price_per_month), start_date, current_period_end")
          .in("status", ["active", "trialing"]),
        supabase.from("subscriptions").select("plan_id, plan:plans(display_name, price_per_month), start_date, current_period_end, status").eq("status", "canceled")
          .gte("current_period_end", ninetyDaysAgo),
      ]);
      return { active: active.data ?? [], canceled: canceled.data ?? [] };
    },
  });

  const planMRR = useMemo(() => {
    const m = new Map<string, { name: string; count: number; price: number; mrr: number }>();
    let mrr = 0;
    (data?.active ?? []).forEach((s: any) => {
      const name = s.plan?.display_name ?? "Unknown";
      const price = Number(s.plan?.price_per_month ?? 0);
      mrr += price;
      const cur = m.get(name) ?? { name, count: 0, price, mrr: 0 };
      cur.count++; cur.mrr += price;
      m.set(name, cur);
    });
    return { breakdown: Array.from(m.values()).sort((a, b) => b.mrr - a.mrr), total: mrr };
  }, [data]);

  const monthly = useMemo(() => {
    const now = new Date();
    const months: { label: string; mrr: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      let mrr = 0;
      (data?.active ?? []).concat(data?.canceled ?? []).forEach((s: any) => {
        const start = new Date(s.start_date);
        const end = s.current_period_end ? new Date(s.current_period_end) : new Date(8.64e15);
        if (start < next && end > d) mrr += Number(s.plan?.price_per_month ?? 0);
      });
      months.push({ label: d.toLocaleString("default", { month: "short" }), mrr });
    }
    return months;
  }, [data]);

  const churn = useMemo(() => {
    const now = Date.now();
    const counts = { d30: 0, d60: 0, d90: 0 };
    let totalDays = 0; let n = 0;
    (data?.canceled ?? []).forEach((s: any) => {
      const end = s.current_period_end ? new Date(s.current_period_end).getTime() : 0;
      if (!end) return;
      const days = Math.floor((now - end) / 86400000);
      if (days <= 30) counts.d30++;
      if (days <= 60) counts.d60++;
      if (days <= 90) counts.d90++;
      const start = new Date(s.start_date).getTime();
      totalDays += Math.max(0, (end - start) / 86400000);
      n++;
    });
    return { ...counts, avgDays: n > 0 ? Math.round(totalDays / n) : 0 };
  }, [data]);

  const maxMrr = Math.max(1, ...monthly.map((m) => m.mrr));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total MRR</div>
        <div className="font-display text-3xl text-foreground mt-1">${planMRR.total.toLocaleString()}</div>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h4 className="font-display text-lg text-foreground mb-3">By plan</h4>
        {planMRR.breakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active plans.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {planMRR.breakdown.map((p) => (
              <li key={p.name} className="flex items-center justify-between">
                <span className="text-foreground">{p.name}</span>
                <span className="text-muted-foreground tabular-nums">{p.count} clients · <span className="text-foreground font-medium">${p.mrr.toLocaleString()}</span> /mo</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h4 className="font-display text-lg text-foreground mb-3">MRR — last 12 months</h4>
        <div className="flex items-end gap-1.5 h-40">
          {monthly.map((m) => (
            <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-primary/70 rounded-t" style={{ height: `${(m.mrr / maxMrr) * 100}%`, minHeight: 2 }} />
              <div className="text-[10px] text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h4 className="font-display text-lg text-foreground mb-3">Churn</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><div className="text-[10px] uppercase text-muted-foreground">Last 30d</div><div className="font-display text-xl">{churn.d30}</div></div>
          <div><div className="text-[10px] uppercase text-muted-foreground">Last 60d</div><div className="font-display text-xl">{churn.d60}</div></div>
          <div><div className="text-[10px] uppercase text-muted-foreground">Last 90d</div><div className="font-display text-xl">{churn.d90}</div></div>
          <div><div className="text-[10px] uppercase text-muted-foreground">Avg sub length</div><div className="font-display text-xl">{churn.avgDays}d</div></div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
