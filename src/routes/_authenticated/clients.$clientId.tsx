import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PagePrimitives";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { ClientProgramsSection } from "@/components/admin/ClientProgramsSection";
import { toast } from "sonner";
import { ArrowLeft, Download, FileText, Check, Loader2, X, Send, ClipboardCheck, CalendarPlus, RefreshCw, XCircle, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import { cn } from "@/lib/utils";
import { sendTransactionalEmail } from "@/lib/email/send";
import { useServerFn } from "@tanstack/react-start";
import { deleteClient } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  component: ClientProfilePage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ClientProfilePage() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const deleteClientFn = useServerFn(deleteClient);
  const [showMessage, setShowMessage] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["client-profile", clientId],
    queryFn: async () => {
      const [user, intake, waiver, sub, plans, completions, attendance, allSlots, mySlots, fulfill, notifs, warmups] = await Promise.all([
        supabase.from("users").select("*").eq("id", clientId).maybeSingle(),
        supabase.from("intake_forms").select("*").eq("user_id", clientId).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("waivers").select("*").eq("user_id", clientId).order("signed_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("subscriptions").select("*, plan:plans(id, type, sessions_per_week, price_per_month, includes_mornings, display_name, created_at)").eq("user_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("plans").select("id, type, sessions_per_week, price_per_month, includes_mornings, display_name, created_at").order("price_per_month"),
        supabase.from("content_completions").select("completed_at").eq("user_id", clientId).order("completed_at", { ascending: false }),
        supabase.from("attendance").select("id, slot_id, session_date, status, notes").eq("user_id", clientId).order("session_date", { ascending: false }),
        supabase.from("slots").select("*").eq("active", true).order("day_of_week").order("time"),
        supabase.from("client_slots").select("id, slot_id").eq("user_id", clientId),
        supabase.from("equipment_fulfillment").select("*").eq("user_id", clientId).maybeSingle(),
        supabase.from("notifications").select("id, type, title, message, created_at, read").eq("user_id", clientId).order("created_at", { ascending: false }).limit(50),
        supabase.from("warmup_completions").select("completed_at").eq("user_id", clientId).order("completed_at", { ascending: false }),
      ]);
      return {
        user: user.data, intake: intake.data, waiver: waiver.data, sub: sub.data,
        plans: plans.data ?? [],
        completions: completions.data ?? [],
        attendance: attendance.data ?? [],
        allSlots: allSlots.data ?? [],
        mySlots: mySlots.data ?? [],
        fulfill: fulfill.data, notifs: notifs.data ?? [],
        warmups: warmups.data ?? [],
      };
    },
  });

  if (isLoading || !data) return <div className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>;
  if (!data.user) return <div className="text-sm text-muted-foreground">Client not found.</div>;

  const u = data.user;
  const slotById = new Map(data.allSlots.map((s: any) => [s.id, s]));
  const mySlotsExpanded = data.mySlots.map((cs: any) => ({ csId: cs.id, slot: slotById.get(cs.slot_id) })).filter((x: any) => x.slot);
  const hasWaiver = !!data.waiver;
  const hasShipping = !!data.fulfill?.shipping_address;
  const canAssignSlot = hasWaiver && hasShipping;
  const assignBlockedReason = !hasWaiver && !hasShipping
    ? "Client must sign the waiver and enter a shipping address first"
    : !hasWaiver ? "Client must sign the waiver first"
    : !hasShipping ? "Client must enter a shipping address first"
    : "";

  function exportWaiverPdf() {
    if (!data?.waiver || !u) return toast.error("No waiver on file");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 54;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableWidth = pageWidth - margin * 2;
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("Liability Waiver", margin, margin);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    let y = margin + 28;
    [
      `Client: ${u.name || u.email}`, `Email: ${u.email}`,
      `Signed at: ${new Date(data.waiver.signed_at).toLocaleString()}`,
      `IP address: ${data.waiver.ip_address ?? "n/a"}`,
    ].forEach((line) => { doc.text(line, margin, y); y += 14; });
    y += 8; doc.line(margin, y, pageWidth - margin, y); y += 16;
    doc.setFontSize(11);
    doc.splitTextToSize(data.waiver.content_snapshot, usableWidth).forEach((ln: string) => {
      if (y > pageHeight - margin) { doc.addPage(); y = margin; }
      doc.text(ln, margin, y); y += 14;
    });
    doc.save(`waiver_${(u.name || u.email).replace(/[^a-z0-9]+/gi, "_")}.pdf`);
  }

  async function removeSlot(csId: string) {
    if (!confirm("Remove client from this slot?")) return;
    const { error } = await supabase.from("client_slots").delete().eq("id", csId);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    qc.invalidateQueries({ queryKey: ["client-profile", clientId] });
  }

  async function changePlan(newPlanId: string) {
    if (!data?.sub) return;
    const { error } = await supabase.from("subscriptions").update({ plan_id: newPlanId }).eq("id", data.sub.id);
    if (error) return toast.error(error.message);
    await supabase.from("activity_log").insert({ type: "plan_change", message: `Plan updated for ${u?.name || u?.email}`, user_id: u?.id });
    toast.success("Plan updated");
    qc.invalidateQueries({ queryKey: ["client-profile", clientId] });
  }

  async function cancelSubscription() {
    if (!data?.sub) return;
    if (!confirm("Cancel this subscription at period end?")) return;
    const { error } = await supabase.from("subscriptions").update({ cancel_at_period_end: true }).eq("id", data.sub.id);
    if (error) return toast.error(error.message);
    await supabase.from("activity_log").insert({ type: "subscription_cancel_scheduled", message: `Subscription cancellation scheduled for ${u?.name || u?.email}`, user_id: u?.id });
    toast.success("Cancellation scheduled");
    qc.invalidateQueries({ queryKey: ["client-profile", clientId] });
  }

  async function handleDelete() {
    const name = u?.name || u?.email || "this client";
    if (!confirm(`Permanently DELETE ${name}? This removes their account, subscription, attendance, intake, waiver, and all related data. This cannot be undone.`)) return;
    if (!confirm(`Are you absolutely sure? Type-check: this will delete ${name} forever.`)) return;
    setDeleting(true);
    try {
      await deleteClientFn({ data: { userId: clientId } });
      toast.success("Client deleted");
      navigate({ to: "/clients" });
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete client");
      setDeleting(false);
    }
  }

  return (
    <>
      <Link to="/clients" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft size={12} /> All clients
      </Link>
      <PageHeader title={u.name || u.email} subtitle={u.email} />

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <ActionBtn icon={<Send size={12} />} label="Send message" onClick={() => setShowMessage(true)} />
        <ActionBtn icon={<ClipboardCheck size={12} />} label="Mark attendance" onClick={() => navigate({ to: "/attendance" })} />
        <ActionBtn icon={<CalendarPlus size={12} />} label="Assign slot" onClick={() => { if (!canAssignSlot) return toast.error(assignBlockedReason); setShowAssign(true); }} disabled={!canAssignSlot} title={canAssignSlot ? undefined : assignBlockedReason} />
        <ActionBtn icon={<RefreshCw size={12} />} label="Update plan" onClick={() => {
          const id = prompt("Enter new plan ID (see plan picker below)");
          if (id) changePlan(id);
        }} />
        <ActionBtn icon={<XCircle size={12} />} label="Cancel subscription" onClick={cancelSubscription} destructive />
        <ActionBtn icon={deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} label={deleting ? "Deleting…" : "Delete client"} onClick={handleDelete} destructive />
      </div>

      <div className="grid gap-6">
        <Section title="Personal info">
          <Row k="Name" v={u.name} />
          <Row k="Email" v={u.email} />
          <Row k="Member since" v={new Date(u.created_at).toLocaleDateString()} />
          <Row k="Shipping address" v={data.fulfill?.shipping_address} multiline />
        </Section>

        <IntakeSection user={u} onChanged={() => qc.invalidateQueries({ queryKey: ["client-profile", clientId] })} />

        <AvailabilityNotesSection user={u} onSaved={() => qc.invalidateQueries({ queryKey: ["client-profile", clientId] })} />


        <Section title="Plan">
          {!data.sub ? <p className="text-sm text-muted-foreground">No subscription.</p> : (
            <>
              <Row k="Plan" v={(data.sub.plan as any)?.display_name} />
              <Row k="Type" v={(data.sub.plan as any)?.type} />
              <Row k="Sessions/week" v={(data.sub.plan as any)?.sessions_per_week?.toString()} />
              <Row k="Price" v={`$${Number((data.sub.plan as any)?.price_per_month ?? 0)}`} />
              <Row k="Status" v={data.sub.status} />
              <Row k="Stripe sub ID" v={data.sub.stripe_subscription_id} />
              <Row k="Commitment ends" v={data.sub.commitment_end_date ? new Date(data.sub.commitment_end_date).toLocaleDateString() : "—"} />
              <Row k="Cancel at period end" v={data.sub.cancel_at_period_end ? "Yes" : "No"} />
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Change plan</summary>
                <div className="mt-2 space-y-1">
                  {data.plans.map((p: any) => (
                    <button key={p.id} onClick={() => changePlan(p.id)}
                      className="block w-full text-left rounded-md border border-border px-2 py-1.5 hover:bg-muted">
                      {p.display_name} — ${p.price_per_month}/mo
                    </button>
                  ))}
                </div>
              </details>
            </>
          )}
        </Section>

        <Section title="Slot assignments">
          {mySlotsExpanded.length === 0 ? (
            <p className="text-sm text-muted-foreground">No slots assigned.</p>
          ) : (
            <ul className="space-y-1.5">
              {mySlotsExpanded.map(({ csId, slot }: any) => (
                <li key={csId} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span className="text-foreground">{DAYS[slot.day_of_week]} {slot.time.slice(0, 5)} · {slot.session_type === "one_on_one" ? "One-On-One" : "Small Group"}</span>
                  <button onClick={() => removeSlot(csId)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => setShowAssign(true)} className="mt-3 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted inline-flex items-center gap-1">
            <CalendarPlus size={12} /> Assign slot
          </button>
        </Section>

        <Section title="Fulfillment">
          {!data.fulfill ? <p className="text-sm text-muted-foreground">N/A</p> : (
            <>
              <Row k="Status" v={data.fulfill.status} />
              <Row k="Shipped at" v={data.fulfill.shipped_at ? new Date(data.fulfill.shipped_at).toLocaleString() : "—"} />
              <Row k="Address" v={data.fulfill.shipping_address} multiline />
            </>
          )}
        </Section>

        <Section title="Onboarding — intake form">
          {!data.intake ? <p className="text-sm text-muted-foreground">Not submitted.</p> : (
            <>
              <Row k="Fitness level" v={data.intake.fitness_level} />
              <Row k="Primary goal" v={data.intake.primary_goal} />
              <Row k="Days/week" v={data.intake.days_per_week?.toString()} />
              <Row k="Injuries" v={data.intake.injuries} multiline />
              <Row k="Referral source" v={data.intake.referral_source} />
              <Row k="Submitted" v={new Date(data.intake.submitted_at).toLocaleString()} />
            </>
          )}
        </Section>

        <Section title="Signed waiver" right={data.waiver && (
          <button onClick={exportWaiverPdf} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted inline-flex items-center gap-1">
            <Download size={12} /> Export PDF
          </button>
        )}>
          {!data.waiver ? <p className="text-sm text-muted-foreground">Not signed.</p> : (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                Signed {new Date(data.waiver.signed_at).toLocaleString()}{data.waiver.ip_address && ` · IP ${data.waiver.ip_address}`}
              </div>
              <div className="rounded-md border border-border bg-background p-3 max-h-64 overflow-y-auto text-xs whitespace-pre-line text-foreground">
                {data.waiver.content_snapshot}
              </div>
            </>
          )}
        </Section>

        <Section title="Progress">
          <ProgressDashboard userId={clientId} />
        </Section>

        <Section title="Attendance history">
          {data.attendance.length === 0 ? <p className="text-sm text-muted-foreground">No records.</p> : (
            <div className="rounded-md border border-border max-h-64 overflow-y-auto divide-y divide-border">
              {data.attendance.map((r: any) => {
                const s: any = slotById.get(r.slot_id);
                const label = r.status === "late_canceled" ? "Late cancel" : r.status === "present" ? "Present" : "Absent";
                const cls = r.status === "present" ? "bg-primary/10 text-primary" : r.status === "late_canceled" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-destructive/10 text-destructive";
                return (
                  <div key={r.id} className="px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">{new Date(r.session_date + "T12:00:00").toLocaleDateString()} · <span className="text-muted-foreground">{s ? `${DAYS[s.day_of_week]} ${s.time.slice(0,5)}` : "Slot"}</span></span>
                      <span className={cn("rounded-full px-2 py-0.5 font-medium uppercase tracking-wide", cls)}>{label}</span>
                    </div>
                    {r.notes && <div className="mt-1 text-foreground whitespace-pre-line bg-muted/50 rounded p-2">{r.notes}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Programs">
          <ClientProgramsSection userId={clientId} />
        </Section>

        <Section title="Content engagement">
          <Row k="Total completions" v={data.completions.length.toString()} />
          <Row k="Last active" v={data.completions[0] ? new Date(data.completions[0].completed_at).toLocaleString() : "—"} />
        </Section>

        <Section title="Warm-up engagement">
          {(() => {
            const fourWeeksAgo = new Date(); fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
            const recent = data.warmups.filter((w: any) => new Date(w.completed_at) >= fourWeeksAgo).length;
            return (
              <>
                <Row k="Total warm-ups completed" v={data.warmups.length.toString()} />
                <Row k="Last warm-up" v={data.warmups[0] ? new Date(data.warmups[0].completed_at).toLocaleString() : "—"} />
                <Row k="Last 4 weeks" v={recent.toString()} />
              </>
            );
          })()}
        </Section>


        <Section title="Notifications log">
          {data.notifs.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto">
              {data.notifs.map((n: any) => (
                <li key={n.id} className="rounded-md border border-border bg-background p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-medium">{n.title || n.type}</span>
                    <span className="text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">{n.message}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {showMessage && <SendMessageDialog user={u} onClose={() => setShowMessage(false)} />}
      {showAssign && (
        <AssignSlotDialog
          clientId={clientId} clientEmail={u.email} clientName={u.name}
          slots={data.allSlots} assigned={new Set(data.mySlots.map((s: any) => s.slot_id))}
          onClose={() => setShowAssign(false)}
          onAssigned={() => qc.invalidateQueries({ queryKey: ["client-profile", clientId] })}
        />
      )}
    </>
  );
}

function ActionBtn({ icon, label, onClick, destructive }: { icon: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button onClick={onClick}
      className={cn("rounded-md border px-3 py-1.5 text-xs inline-flex items-center gap-1.5",
        destructive ? "border-destructive/40 text-destructive hover:bg-destructive/5" : "border-border hover:bg-muted")}>
      {icon} {label}
    </button>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg text-foreground">{title}</h3>
        {right}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ k, v, multiline }: { k: string; v: string | null | undefined; multiline?: boolean }) {
  return (
    <div className={cn("grid gap-0.5 text-sm", multiline ? "" : "grid-cols-[160px_1fr] items-baseline")}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className={cn("text-foreground", multiline && "whitespace-pre-line")}>{v || "—"}</dd>
    </div>
  );
}

function SendMessageDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!body.trim()) return toast.error("Message required");
    setBusy(true);
    const { error } = await supabase.from("notifications").insert({
      user_id: user.id, type: "broadcast", title: title || "Message from your studio", message: body,
    });
    if (error) { setBusy(false); return toast.error(error.message); }
    try {
      await sendTransactionalEmail({
        templateName: "admin-broadcast",
        recipientEmail: user.email,
        idempotencyKey: `direct-${user.id}-${Date.now()}`,
        templateData: { name: user.name ?? undefined, subject: title || "A note from your studio", body },
      });
    } catch (e) { console.error(e); }
    await supabase.from("activity_log").insert({ type: "direct_message", message: `Direct message sent to ${user.name || user.email}`, user_id: user.id });
    toast.success("Sent");
    setBusy(false); onClose();
  }
  return (
    <Modal title="Send direct message" onClose={onClose}>
      <input placeholder="Subject" value={title} onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm mb-2" />
      <textarea placeholder="Message" rows={5} value={body} onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      <div className="flex justify-end gap-2 pt-3">
        <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs">Cancel</button>
        <button onClick={send} disabled={busy} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs disabled:opacity-50">Send</button>
      </div>
    </Modal>
  );
}

function AssignSlotDialog({ clientId, clientEmail, clientName, slots, assigned, onClose, onAssigned }: {
  clientId: string; clientEmail: string; clientName: string | null;
  slots: any[]; assigned: Set<string>; onClose: () => void; onAssigned: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  async function assign(slot: any) {
    setBusy(slot.id);
    const { error } = await supabase.from("client_slots").insert({ slot_id: slot.id, user_id: clientId });
    if (error) { setBusy(null); return toast.error(error.message); }
    await supabase.from("users").update({ needs_slot_assignment: false }).eq("id", clientId);
    await supabase.from("notifications").insert({
      user_id: clientId, type: "slot", title: "Your slot is assigned",
      message: `You're booked for ${DAYS[slot.day_of_week]} ${slot.time.slice(0,5)}.`, link: "/portal",
    });
    try {
      await sendTransactionalEmail({
        templateName: "slot-assigned", recipientEmail: clientEmail,
        idempotencyKey: `slot-assigned-${clientId}-${slot.id}`,
        templateData: { name: clientName ?? undefined, day: DAYS[slot.day_of_week], time: slot.time.slice(0,5), type: slot.session_type },
      });
    } catch (e) { console.error(e); }
    toast.success("Assigned"); onAssigned(); setBusy(null); onClose();
  }
  const available = slots.filter((s: any) => !assigned.has(s.id));
  return (
    <Modal title="Assign slot" onClose={onClose}>
      {available.length === 0 ? (
        <p className="text-sm text-muted-foreground">No available slots.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto divide-y divide-border rounded-md border border-border">
          {available.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between p-3 text-sm">
              <span className="text-foreground">{DAYS[s.day_of_week]} {s.time.slice(0,5)} · {s.session_type === "one_on_one" ? "One-On-One" : "Small Group"}</span>
              <button onClick={() => assign(s)} disabled={busy === s.id}
                className="rounded-md bg-primary text-primary-foreground px-2.5 py-1 text-xs disabled:opacity-50">Assign</button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function IntakeSection({ user, onChanged }: { user: any; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  async function markComplete() {
    setBusy(true);
    const { error } = await supabase
      .from("users")
      .update({ intake_completed_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) { setBusy(false); return toast.error(error.message); }
    try {
      await sendTransactionalEmail({
        templateName: "intake-complete",
        recipientEmail: user.email,
        idempotencyKey: `intake-complete-${user.id}`,
        templateData: { name: user.name ?? undefined, loginUrl: `${window.location.origin}/login` },
      });
      toast.success("Intake marked complete — email sent.");
    } catch (e) {
      console.error(e);
      toast.success("Intake marked complete (email failed to send).");
    }
    setBusy(false);
    onChanged();
  }
  async function clearComplete() {
    if (!confirm("Mark intake as not yet completed?")) return;
    setBusy(true);
    const { error } = await supabase
      .from("users")
      .update({ intake_completed_at: null })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Reset");
    onChanged();
  }

  return (
    <Section title="Intake session">
      <Row k="Paid" v={user.intake_paid_at ? new Date(user.intake_paid_at).toLocaleString() : "Not yet"} />
      <Row k="Completed" v={user.intake_completed_at ? new Date(user.intake_completed_at).toLocaleString() : "Not yet"} />
      <div className="pt-2 flex gap-2 flex-wrap">
        {!user.intake_completed_at ? (
          <button
            onClick={markComplete}
            disabled={busy || !user.intake_paid_at}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy && <Loader2 size={12} className="animate-spin" />}
            Mark intake complete
          </button>
        ) : (
          <button
            onClick={clearComplete}
            disabled={busy}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          >
            Reset intake status
          </button>
        )}
        {!user.intake_paid_at && (
          <span className="text-xs text-muted-foreground self-center">Client must pay before marking complete.</span>
        )}
      </div>
    </Section>
  );
}

function AvailabilityNotesSection({ user, onSaved }: { user: any; onSaved: () => void }) {
  const [notes, setNotes] = useState(user.availability_notes ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNotes(user.availability_notes ?? ""); }, [user.availability_notes]);

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("users")
      .update({ availability_notes: notes || null })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  }

  return (
    <Section title="Availability notes">
      <p className="text-xs text-muted-foreground mb-2">From the intake session — what days/times work for this client.</p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="e.g. Weekdays before 9am or after 6pm. Saturday mornings flexible."
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="pt-2">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {busy && <Loader2 size={12} className="animate-spin" />}
          Save notes
        </button>
      </div>
    </Section>
  );
}
