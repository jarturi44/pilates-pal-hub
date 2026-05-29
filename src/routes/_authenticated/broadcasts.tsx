import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PagePrimitives";
import { sendTransactionalEmail } from "@/lib/email/send";
import { toast } from "sonner";
import { Loader2, Send, Eye, Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/broadcasts")({
  component: BroadcastsPage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Audience = { type: "all_active" | "plan_type" | "slot"; value?: string; label: string };

function BroadcastsPage() {
  const { role, user } = useAuth();
  const qc = useQueryClient();
  if (role !== "admin") return <Navigate to="/home" />;

  const [audType, setAudType] = useState<Audience["type"]>("all_active");
  const [audValue, setAudValue] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: plans = [] } = useQuery({
    queryKey: ["plans-for-broadcast"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("type, display_name").order("display_name");
      // unique types
      const seen = new Set<string>();
      return (data ?? []).filter((p: any) => { if (seen.has(p.type)) return false; seen.add(p.type); return true; }) as { type: string; display_name: string }[];
    },
  });

  const { data: slots = [] } = useQuery({
    queryKey: ["slots-for-broadcast"],
    queryFn: async () => {
      const { data } = await supabase.from("slots").select("id, day_of_week, time, session_type")
        .order("day_of_week").order("time");
      return data ?? [];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["broadcast-history"],
    queryFn: async () => {
      const { data } = await supabase.from("broadcasts").select("*")
        .order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const audienceLabel = useMemo(() => {
    if (audType === "all_active") return "All active clients";
    if (audType === "plan_type") return `Plan: ${plans.find((p) => p.type === audValue)?.display_name ?? audValue}`;
    if (audType === "slot") {
      const s: any = slots.find((s: any) => s.id === audValue);
      return s ? `Slot: ${DAYS[s.day_of_week]} ${s.time.slice(0, 5)}` : "Slot";
    }
    return "";
  }, [audType, audValue, plans, slots]);

  async function resolveRecipients(): Promise<{ id: string; email: string; name: string | null }[]> {
    // Get active subscriber user_ids, optionally filtered.
    let q = supabase.from("subscriptions").select("user_id, plan:plans(type)").in("status", ["active", "trialing"]);
    const { data: subs } = await q;
    let userIds = Array.from(new Set((subs ?? []).map((s: any) => s.user_id)));
    if (audType === "plan_type") {
      const ids = (subs ?? []).filter((s: any) => s.plan?.type === audValue).map((s: any) => s.user_id);
      userIds = Array.from(new Set(ids));
    } else if (audType === "slot") {
      const { data: cs } = await supabase.from("client_slots").select("user_id").eq("slot_id", audValue);
      const slotUsers = new Set((cs ?? []).map((c: any) => c.user_id));
      userIds = userIds.filter((id) => slotUsers.has(id));
    }
    if (userIds.length === 0) return [];
    const { data: users } = await supabase.from("users").select("id, email, name").in("id", userIds);
    return (users ?? []) as any;
  }

  async function send() {
    if (!subject.trim() || !body.trim()) return toast.error("Subject and body required");
    if (audType !== "all_active" && !audValue) return toast.error("Select an audience");
    setSending(true);
    try {
      const recipients = await resolveRecipients();
      if (recipients.length === 0) {
        toast.error("No matching recipients");
        setSending(false);
        return;
      }
      // In-app notifications
      const rows = recipients.map((r) => ({
        user_id: r.id, type: "broadcast", title: subject, message: body, read: false,
      }));
      await supabase.from("notifications").insert(rows);
      // Emails
      const broadcastId = crypto.randomUUID();
      let sent = 0;
      await Promise.all(recipients.map(async (r) => {
        if (!r.email) return;
        try {
          await sendTransactionalEmail({
            templateName: "admin-broadcast",
            recipientEmail: r.email,
            idempotencyKey: `broadcast-${broadcastId}-${r.id}`,
            templateData: { name: r.name ?? undefined, subject, body },
          });
          sent++;
        } catch (e) { console.error("broadcast email failed", e); }
      }));
      // Log
      await supabase.from("broadcasts").insert({
        id: broadcastId,
        sent_by: user!.id,
        audience_type: audType,
        audience_value: audValue || null,
        audience_label: audienceLabel,
        subject, body,
        recipient_count: recipients.length,
      });
      toast.success(`Sent to ${recipients.length} recipient${recipients.length > 1 ? "s" : ""} (${sent} emails)`);
      setSubject(""); setBody(""); setPreviewing(false);
      qc.invalidateQueries({ queryKey: ["broadcast-history"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader title="Messages" subtitle="Send a broadcast to your clients." />

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Audience</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["all_active", "plan_type", "slot"] as const).map((t) => (
                <button key={t} onClick={() => { setAudType(t); setAudValue(""); }}
                  className={`rounded-md border px-3 py-1.5 text-xs ${audType === t ? "border-primary bg-primary/5" : "border-border text-muted-foreground"}`}>
                  {t === "all_active" ? "All active" : t === "plan_type" ? "By plan" : "By slot"}
                </button>
              ))}
            </div>
            {audType === "plan_type" && (
              <select value={audValue} onChange={(e) => setAudValue(e.target.value)}
                className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Choose a plan type…</option>
                {plans.map((p) => <option key={p.type} value={p.type}>{p.display_name}</option>)}
              </select>
            )}
            {audType === "slot" && (
              <select value={audValue} onChange={(e) => setAudValue(e.target.value)}
                className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Choose a slot…</option>
                {slots.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {DAYS[s.day_of_week]} {s.time.slice(0, 5)} · {s.session_type === "one_on_one" ? "One-On-One" : "Small Group"}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Studio update" />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Message</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Hi everyone — …" />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setPreviewing(true)}
              className="rounded-md border border-border px-3 py-2 text-xs inline-flex items-center gap-1.5">
              <Eye size={12} /> Preview
            </button>
            <button onClick={send} disabled={sending}
              className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Send broadcast
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone size={14} className="text-muted-foreground" />
            <h2 className="font-display text-lg">Recent broadcasts</h2>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No broadcasts yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((b: any) => (
                <li key={b.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm text-foreground">{b.subject}</div>
                    <div className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {b.audience_label} · {b.recipient_count} recipient{b.recipient_count !== 1 ? "s" : ""}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">{b.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {previewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4" onClick={() => setPreviewing(false)}>
          <div className="bg-background rounded-xl border border-border max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Preview · {audienceLabel}</div>
            <div className="font-display text-xl mb-3">{subject || "(no subject)"}</div>
            <div className="text-sm text-foreground whitespace-pre-line">{body || "(no body)"}</div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setPreviewing(false)} className="rounded-md border border-border px-3 py-1.5 text-xs">Close</button>
              <button onClick={send} disabled={sending} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs">Send now</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
