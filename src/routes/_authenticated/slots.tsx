import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PagePrimitives";
import { toast } from "sonner";
import { Plus, Trash2, X, AlertTriangle, EyeOff, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendTransactionalEmail } from "@/lib/email/send";

export const Route = createFileRoute("/_authenticated/slots")({
  component: SlotsPage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Slot = { id: string; day_of_week: number; time: string; session_type: "one_on_one" | "small_group"; capacity: number; active: boolean };
type Assignment = { id: string; slot_id: string; user_id: string };
type ClientLite = { id: string; name: string | null; email: string };

function SlotsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [assignTo, setAssignTo] = useState<Slot | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["slots-mgmt"],
    queryFn: async () => {
      const [slots, cs, users] = await Promise.all([
        supabase.from("slots").select("*").order("day_of_week").order("time"),
        supabase.from("client_slots").select("*"),
        supabase.from("users").select("id, name, email").eq("role", "client"),
      ]);
      return {
        slots: (slots.data ?? []) as Slot[],
        assignments: (cs.data ?? []) as Assignment[],
        clients: (users.data ?? []) as ClientLite[],
      };
    },
  });

  async function deactivate(s: Slot) {
    if (!confirm(`${s.active ? "Deactivate" : "Reactivate"} this slot?`)) return;
    const { error } = await supabase.from("slots").update({ active: !s.active }).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Slot updated");
    qc.invalidateQueries({ queryKey: ["slots-mgmt"] });
  }

  async function removeAssignment(a: Assignment, clientName: string) {
    if (!confirm(`Remove ${clientName} from this slot?`)) return;
    const { error } = await supabase.from("client_slots").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    qc.invalidateQueries({ queryKey: ["slots-mgmt"] });
  }

  const slotsByDay = new Map<number, Slot[]>();
  (data?.slots ?? []).forEach((s) => {
    const arr = slotsByDay.get(s.day_of_week) ?? [];
    arr.push(s); slotsByDay.set(s.day_of_week, arr);
  });
  const clientById = new Map((data?.clients ?? []).map((c) => [c.id, c]));
  const assignmentsBySlot = new Map<string, Assignment[]>();
  (data?.assignments ?? []).forEach((a) => {
    const arr = assignmentsBySlot.get(a.slot_id) ?? [];
    arr.push(a); assignmentsBySlot.set(a.slot_id, arr);
  });

  return (
    <>
      <PageHeader title="Slots" subtitle="Weekly recurring sessions and client assignments." />

      <div className="flex justify-end mb-4">
        <button onClick={() => setShowCreate(true)} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs inline-flex items-center gap-1.5">
          <Plus size={14} /> New slot
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-6">
          {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
            const slots = slotsByDay.get(dow) ?? [];
            if (slots.length === 0) return null;
            return (
              <section key={dow}>
                <h3 className="font-display text-lg text-foreground mb-2">{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][dow]}</h3>
                <div className="space-y-2">
                  {slots.map((s) => {
                    const assigns = assignmentsBySlot.get(s.id) ?? [];
                    const full = assigns.length >= s.capacity;
                    return (
                      <div key={s.id} className={cn("rounded-xl border bg-card p-4", !s.active && "opacity-60", full && s.active && "border-amber-500/50")}>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div>
                            <div className="font-medium text-foreground">
                              {s.time.slice(0, 5)} · {s.session_type === "one_on_one" ? "One-On-One" : "Small Group"}
                              {!s.active && <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">(inactive)</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {assigns.length} / {s.capacity} clients
                              {full && s.active && <span className="ml-2 text-amber-600 inline-flex items-center gap-1"><AlertTriangle size={11} /> at capacity</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setAssignTo(s)}
                              disabled={!s.active || full}
                              className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
                            >Assign client</button>
                            <button onClick={() => deactivate(s)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted" title={s.active ? "Deactivate" : "Reactivate"}>
                              {s.active ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>
                        </div>
                        {assigns.length > 0 && (
                          <ul className="flex flex-wrap gap-1.5">
                            {assigns.map((a) => {
                              const c = clientById.get(a.user_id);
                              const label = c?.name || c?.email || "Unknown";
                              return (
                                <li key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs">
                                  {label}
                                  <button onClick={() => removeAssignment(a, label)} className="text-muted-foreground hover:text-destructive">
                                    <X size={10} />
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {(data?.slots.length ?? 0) === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No slots yet. Click "New slot" to create one.
            </div>
          )}
        </div>
      )}

      {showCreate && <CreateSlotDialog onClose={() => setShowCreate(false)} />}
      {assignTo && (
        <AssignClientDialog
          slot={assignTo}
          assigned={new Set((assignmentsBySlot.get(assignTo.id) ?? []).map((a) => a.user_id))}
          clients={data?.clients ?? []}
          onClose={() => setAssignTo(null)}
        />
      )}
    </>
  );
}

function CreateSlotDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [day, setDay] = useState(1);
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState<"one_on_one" | "small_group">("one_on_one");
  const [capacity, setCapacity] = useState(1);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("slots").insert({ day_of_week: day, time, session_type: type, capacity });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Slot created");
    qc.invalidateQueries({ queryKey: ["slots-mgmt"] });
    onClose();
  }

  return (
    <Modal title="New slot" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Day">
          <select value={day} onChange={(e) => setDay(+e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            {[1,2,3,4,5,6,0].map((d) => <option key={d} value={d}>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d]}</option>)}
          </select>
        </Field>
        <Field label="Time">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </Field>
        <Field label="Session type">
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="one_on_one">One-On-One</option>
            <option value="small_group">Small Group</option>
          </select>
        </Field>
        <Field label="Capacity">
          <input type="number" min={1} max={20} value={capacity} onChange={(e) => setCapacity(+e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs disabled:opacity-50">Create</button>
        </div>
      </div>
    </Modal>
  );
}

function AssignClientDialog({ slot, assigned, clients, onClose }: { slot: Slot; assigned: Set<string>; clients: ClientLite[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = clients
    .filter((c) => !assigned.has(c.id))
    .filter((c) => {
      if (!q) return true;
      const s = q.toLowerCase();
      return (c.name ?? "").toLowerCase().includes(s) || c.email.toLowerCase().includes(s);
    })
    .slice(0, 30);

  async function assign(c: ClientLite) {
    setBusy(c.id);
    const { error } = await supabase.from("client_slots").insert({ slot_id: slot.id, user_id: c.id });
    if (error) { setBusy(null); return toast.error(error.message); }
    await supabase.from("users").update({ needs_slot_assignment: false }).eq("id", c.id);
    await supabase.from("notifications").insert({
      user_id: c.id, type: "slot", title: "Your slot is assigned",
      message: `You're booked for ${DAYS[slot.day_of_week]} ${slot.time.slice(0, 5)} (${slot.session_type === "one_on_one" ? "One-On-One" : "Small Group"}).`,
      link: "/my-program",
    });
    try {
      await sendTransactionalEmail({
        templateName: "slot-assigned",
        recipientEmail: c.email,
        idempotencyKey: `slot-assigned-${c.id}-${slot.id}`,
        templateData: { name: c.name ?? undefined, day: DAYS[slot.day_of_week], time: slot.time.slice(0, 5), type: slot.session_type },
      });
    } catch (e) { console.error(e); }
    await supabase.from("activity_log").insert({ type: "slot_assigned", message: `${c.name || c.email} assigned to ${DAYS[slot.day_of_week]} ${slot.time.slice(0, 5)}`, user_id: c.id });
    toast.success("Assigned");
    qc.invalidateQueries({ queryKey: ["slots-mgmt"] });
    setBusy(null);
  }

  return (
    <Modal title={`Assign to ${DAYS[slot.day_of_week]} ${slot.time.slice(0, 5)}`} onClose={onClose}>
      <input
        placeholder="Search clients…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm mb-3"
        autoFocus
      />
      <div className="max-h-80 overflow-y-auto divide-y divide-border rounded-md border border-border">
        {filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No clients found.</div>
        ) : filtered.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-3">
            <div className="min-w-0">
              <div className="text-sm text-foreground truncate">{c.name || c.email}</div>
              <div className="text-xs text-muted-foreground truncate">{c.email}</div>
            </div>
            <button onClick={() => assign(c)} disabled={busy === c.id} className="rounded-md bg-primary text-primary-foreground px-2.5 py-1 text-xs disabled:opacity-50">Assign</button>
          </div>
        ))}
      </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
