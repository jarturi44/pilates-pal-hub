import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PagePrimitives";
import { toast } from "sonner";
import { Loader2, Check, X, Clock as ClockIcon, NotebookPen, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Status = "present" | "absent" | "late_canceled";

type Slot = {
  id: string;
  day_of_week: number;
  time: string;
  session_type: "private" | "semi_private";
  capacity: number;
};

type ClientAssignment = {
  user_id: string;
  user: { name: string | null; email: string } | null;
};

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function AttendancePage() {
  const { role } = useAuth();
  const [date, setDate] = useState(todayStr());

  if (role !== "admin") return <Navigate to="/home" />;

  const minDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const { data: slots, isLoading } = useQuery({
    queryKey: ["att-slots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("slots").select("*")
        .order("day_of_week", { ascending: true }).order("time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Slot[];
    },
  });

  // Filter slots to those whose day_of_week matches the chosen date
  const dayOfWeek = new Date(date + "T00:00:00").getDay();
  const todaysSlots = useMemo(
    () => (slots ?? []).filter((s) => s.day_of_week === dayOfWeek),
    [slots, dayOfWeek],
  );

  return (
    <>
      <PageHeader title="Attendance" subtitle="Mark attendance per slot. Defaults to today; up to 30 days back." />

      <div className="flex items-center gap-3 mb-6">
        <CalendarIcon size={16} className="text-muted-foreground" />
        <input
          type="date"
          value={date}
          min={minDate}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
        <span className="text-xs text-muted-foreground">{DAYS[dayOfWeek]}</span>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : todaysSlots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No slots scheduled for {DAYS[dayOfWeek]}.
        </div>
      ) : (
        <div className="space-y-4">
          {todaysSlots.map((s) => <SlotCard key={s.id} slot={s} sessionDate={date} />)}
        </div>
      )}
    </>
  );
}

function SlotCard({ slot, sessionDate }: { slot: Slot; sessionDate: string }) {
  const qc = useQueryClient();

  const { data: assignments } = useQuery({
    queryKey: ["slot-clients", slot.id],
    queryFn: async () => {
      const { data: cs, error } = await supabase
        .from("client_slots")
        .select("user_id")
        .eq("slot_id", slot.id);
      if (error) throw error;
      const ids = (cs ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [] as ClientAssignment[];
      const { data: users } = await supabase
        .from("users").select("id, name, email").in("id", ids);
      const byId = new Map((users ?? []).map((u) => [u.id, u]));
      return ids.map((id) => ({ user_id: id, user: byId.get(id) ? { name: byId.get(id)!.name, email: byId.get(id)!.email } : null })) as ClientAssignment[];
    },
  });

  const { data: existing } = useQuery({
    queryKey: ["att-records", slot.id, sessionDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, user_id, status, attended, notes")
        .eq("slot_id", slot.id)
        .eq("session_date", sessionDate);
      if (error) throw error;
      return (data ?? []) as { id: string; user_id: string; status: Status; attended: boolean; notes: string | null }[];
    },
  });

  const recByUser = useMemo(() => {
    const m = new Map<string, { id: string; status: Status; notes: string | null }>();
    (existing ?? []).forEach((r) => m.set(r.user_id, { id: r.id, status: r.status, notes: r.notes }));
    return m;
  }, [existing]);

  async function setStatus(userId: string, status: Status, notes?: string | null) {
    const payload = {
      user_id: userId,
      slot_id: slot.id,
      session_date: sessionDate,
      status,
      attended: status === "present",
      notes: notes ?? recByUser.get(userId)?.notes ?? null,
    };
    const { error } = await supabase
      .from("attendance")
      .upsert(payload, { onConflict: "user_id,slot_id,session_date" });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["att-records", slot.id, sessionDate] });
  }

  async function markAllPresent() {
    if (!assignments?.length) return;
    const rows = assignments.map((a) => ({
      user_id: a.user_id,
      slot_id: slot.id,
      session_date: sessionDate,
      status: "present" as const,
      attended: true,
      notes: recByUser.get(a.user_id)?.notes ?? null,
    }));
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "user_id,slot_id,session_date" });
    if (error) return toast.error(error.message);
    toast.success("All marked present");
    qc.invalidateQueries({ queryKey: ["att-records", slot.id, sessionDate] });
  }

  const time = slot.time.slice(0, 5);
  const label = `${DAYS[slot.day_of_week]} ${time} · ${slot.session_type === "private" ? "Private" : "Semi-Private"}`;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="font-medium text-foreground">{label}</div>
        <button
          onClick={markAllPresent}
          disabled={!assignments?.length}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
        >
          Mark all present
        </button>
      </div>
      {!assignments?.length ? (
        <p className="text-sm text-muted-foreground">No clients assigned to this slot.</p>
      ) : (
        <ul className="divide-y divide-border">
          {assignments.map((a) => (
            <ClientRow
              key={a.user_id}
              name={a.user?.name || a.user?.email || "Unknown"}
              email={a.user?.email ?? ""}
              record={recByUser.get(a.user_id)}
              onSetStatus={(s) => setStatus(a.user_id, s)}
              onSaveNote={(note) => setStatus(a.user_id, recByUser.get(a.user_id)?.status ?? "present", note)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ClientRow({ name, email, record, onSetStatus, onSaveNote }: {
  name: string;
  email: string;
  record?: { status: Status; notes: string | null };
  onSetStatus: (s: Status) => void;
  onSaveNote: (note: string) => void;
}) {
  const status = record?.status;
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState(record?.notes ?? "");

  useEffect(() => { setNote(record?.notes ?? ""); }, [record?.notes]);

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{name}</div>
          <div className="text-xs text-muted-foreground truncate">{email}</div>
        </div>
        <div className="flex items-center gap-1">
          <StatusButton active={status === "present"} onClick={() => onSetStatus("present")} variant="present" icon={Check} label="Present" />
          <StatusButton active={status === "absent"} onClick={() => onSetStatus("absent")} variant="absent" icon={X} label="Absent" />
          <StatusButton active={status === "late_canceled"} onClick={() => onSetStatus("late_canceled")} variant="late" icon={ClockIcon} label="Late cancel" />
          <button
            onClick={() => setShowNote((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
              record?.notes ? "border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
            title="Private session note"
          >
            <NotebookPen size={12} />
          </button>
        </div>
      </div>
      {showNote && (
        <div className="mt-2 flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Private note (not visible to client)"
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs"
          />
          <button
            onClick={() => { onSaveNote(note); setShowNote(false); toast.success("Note saved"); }}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs"
          >Save</button>
        </div>
      )}
    </li>
  );
}

function StatusButton({ active, onClick, variant, icon: Icon, label }: {
  active: boolean;
  onClick: () => void;
  variant: "present" | "absent" | "late";
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}) {
  const styles = active
    ? variant === "present" ? "border-primary bg-primary text-primary-foreground"
      : variant === "absent" ? "border-destructive bg-destructive/10 text-destructive"
      : "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
    : "border-border text-muted-foreground hover:text-foreground";
  return (
    <button onClick={onClick}
      className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs", styles)}
      title={label}
    >
      <Icon size={12} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
