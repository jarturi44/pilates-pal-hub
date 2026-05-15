import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, Users, X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Program = {
  id: string;
  name: string;
  description: string | null;
  frequency: string | null;
  active: boolean;
};

type Exercise = { id: string; title: string; category: string | null; difficulty: string | null };
type ProgramExercise = { id: string; program_id: string; exercise_id: string; position: number; notes: string | null; exercise?: Exercise };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ProgramsAdmin() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [assigningProgram, setAssigningProgram] = useState<Program | null>(null);

  const { data: programs, isLoading } = useQuery({
    queryKey: ["admin-programs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("programs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Program[];
    },
  });

  const { data: assignmentCounts } = useQuery({
    queryKey: ["admin-program-assignment-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("program_assignments").select("program_id").eq("active", true);
      const map = new Map<string, number>();
      (data ?? []).forEach((r: any) => map.set(r.program_id, (map.get(r.program_id) ?? 0) + 1));
      return map;
    },
  });

  async function toggleActive(p: Program) {
    const { error } = await supabase.from("programs").update({ active: !p.active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-programs"] });
  }

  async function remove(p: Program) {
    if (!confirm(`Delete "${p.name}"? This will unassign clients.`)) return;
    const { error } = await supabase.from("programs").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-programs"] });
  }

  async function duplicate(p: Program) {
    const [{ data: created, error }] = await Promise.all([
      supabase.from("programs").insert({ name: `${p.name} (copy)`, description: p.description, frequency: p.frequency, active: p.active }).select().single(),
    ]);
    if (error || !created) return toast.error(error?.message ?? "Failed");
    const { data: rows } = await supabase.from("program_exercises").select("*").eq("program_id", p.id);
    if (rows && rows.length > 0) {
      await supabase.from("program_exercises").insert(rows.map((r: any) => ({
        program_id: created.id, exercise_id: r.exercise_id, position: r.position, notes: r.notes,
      })));
    }
    toast.success("Duplicated");
    qc.invalidateQueries({ queryKey: ["admin-programs"] });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-muted-foreground">Build programs by sequencing exercises and assign them to clients.</p>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90">
          <Plus size={14} /> New program
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (programs ?? []).length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">No programs yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(programs ?? []).map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="font-medium text-foreground">{p.name}</div>
                {!p.active && <span className="text-[10px] uppercase tracking-wide rounded-full bg-muted px-2 py-0.5 text-muted-foreground">Hidden</span>}
              </div>
              {p.frequency && <div className="text-xs text-muted-foreground mb-1">{p.frequency}</div>}
              {p.description && <div className="text-xs text-muted-foreground line-clamp-2 mb-2">{p.description}</div>}
              <div className="text-xs text-muted-foreground mb-3">
                <Users size={12} className="inline mr-1" />
                {assignmentCounts?.get(p.id) ?? 0} assigned
              </div>
              <div className="flex gap-1 mt-auto pt-2 border-t border-border">
                <button onClick={() => setEditingId(p.id)} className="flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-md hover:bg-muted text-foreground"><Pencil size={12} /> Edit</button>
                <button onClick={() => setAssigningProgram(p)} className="flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-md hover:bg-muted text-foreground"><Users size={12} /> Assign</button>
                <button onClick={() => duplicate(p)} title="Duplicate" className="p-2 text-muted-foreground hover:text-foreground"><Copy size={12} /></button>
                <button onClick={() => toggleActive(p)} title={p.active ? "Deactivate" : "Activate"} className="p-2 text-muted-foreground hover:text-foreground">
                  {p.active ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <button onClick={() => remove(p)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editingId) && (
        <ProgramEditor
          programId={editingId}
          onClose={() => { setCreating(false); setEditingId(null); }}
          onSaved={() => { setCreating(false); setEditingId(null); qc.invalidateQueries({ queryKey: ["admin-programs"] }); }}
        />
      )}
      {assigningProgram && (
        <ProgramAssignDialog
          program={assigningProgram}
          onClose={() => setAssigningProgram(null)}
          onAssigned={() => { qc.invalidateQueries({ queryKey: ["admin-program-assignment-counts"] }); }}
        />
      )}
    </div>
  );
}

function ProgramEditor({ programId, onClose, onSaved }: { programId: string | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !programId;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("3x per week");
  const [active, setActive] = useState(true);
  const [items, setItems] = useState<{ exercise_id: string; notes: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(isNew);

  const { data: allExercises } = useQuery({
    queryKey: ["exercises-all-active"],
    queryFn: async () => {
      const { data } = await supabase.from("exercises").select("id, title, category, difficulty").eq("active", true).order("title");
      return (data ?? []) as Exercise[];
    },
  });

  // Load existing program once
  useQuery({
    enabled: !!programId && !loaded,
    queryKey: ["program-edit", programId],
    queryFn: async () => {
      const [{ data: p }, { data: rows }] = await Promise.all([
        supabase.from("programs").select("*").eq("id", programId!).maybeSingle(),
        supabase.from("program_exercises").select("*").eq("program_id", programId!).order("position"),
      ]);
      if (p) {
        setName(p.name); setDescription(p.description ?? ""); setFrequency(p.frequency ?? ""); setActive(p.active);
      }
      setItems((rows ?? []).map((r: any) => ({ exercise_id: r.exercise_id, notes: r.notes ?? "" })));
      setLoaded(true);
      return true;
    },
  });

  function addExercise(id: string) {
    if (items.find((i) => i.exercise_id === id)) return toast.error("Already in program");
    setItems([...items, { exercise_id: id, notes: "" }]);
    setAdding(false);
  }
  function move(idx: number, dir: -1 | 1) {
    const ni = idx + dir;
    if (ni < 0 || ni >= items.length) return;
    const next = items.slice();
    [next[idx], next[ni]] = [next[ni], next[idx]];
    setItems(next);
  }
  function removeAt(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }
  function updateNotes(idx: number, val: string) {
    const next = items.slice();
    next[idx] = { ...next[idx], notes: val };
    setItems(next);
  }

  const exById = useMemo(() => new Map((allExercises ?? []).map((e) => [e.id, e])), [allExercises]);

  async function save() {
    if (!name.trim()) return toast.error("Name required");
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null, frequency: frequency.trim() || null, active };
    let pid: string;
    if (isNew) {
      const { data: created, error } = await supabase.from("programs").insert(payload).select().single();
      if (error || !created) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
      pid = created.id;
    } else {
      const { error } = await supabase.from("programs").update(payload).eq("id", programId!);
      if (error) { setSaving(false); return toast.error(error.message); }
      pid = programId!;
    }
    // Replace exercise list
    await supabase.from("program_exercises").delete().eq("program_id", pid);
    if (items.length > 0) {
      const rows = items.map((it, i) => ({ program_id: pid, exercise_id: it.exercise_id, position: i, notes: it.notes || null }));
      const { error } = await supabase.from("program_exercises").insert(rows);
      if (error) { setSaving(false); return toast.error(error.message); }
    }
    setSaving(false);
    toast.success("Saved");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-2xl bg-background border-l border-border h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-foreground">{isNew ? "New program" : "Edit program"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label="Intended frequency">
            <input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="3x per week" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active (visible to assigned clients)
          </label>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Exercises ({items.length})</span>
              <button onClick={() => setAdding(true)} className="text-xs inline-flex items-center gap-1 text-primary"><Plus size={12} /> Add</button>
            </div>
            {items.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No exercises yet.</div>
            ) : (
              <ol className="space-y-2">
                {items.map((it, idx) => {
                  const ex = exById.get(it.exercise_id);
                  return (
                    <li key={`${it.exercise_id}-${idx}`} className="rounded-md border border-border bg-card p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col">
                          <button disabled={idx === 0} onClick={() => move(idx, -1)} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp size={12} /></button>
                          <button disabled={idx === items.length - 1} onClick={() => move(idx, 1)} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown size={12} /></button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground">{idx + 1}. {ex?.title ?? "Unknown exercise"}</div>
                          {ex && <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{ex.category} · {ex.difficulty}</div>}
                          <input
                            value={it.notes}
                            onChange={(e) => updateNotes(idx, e.target.value)}
                            placeholder="Notes (e.g. 2 sets of 10, hold 30s)"
                            className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                          />
                        </div>
                        <button onClick={() => removeAt(idx)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <button onClick={save} disabled={saving} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm hover:opacity-90 inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />} Save program
          </button>
        </div>

        {adding && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setAdding(false)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-background border border-border rounded-xl w-full max-w-md max-h-[70vh] overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg">Add exercise</h3>
                <button onClick={() => setAdding(false)} className="text-muted-foreground"><X size={16} /></button>
              </div>
              <div className="divide-y divide-border">
                {(allExercises ?? []).map((e) => (
                  <button key={e.id} onClick={() => addExercise(e.id)} className="w-full text-left py-2 hover:bg-muted px-2 rounded">
                    <div className="text-sm text-foreground">{e.title}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{e.category} · {e.difficulty}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function ProgramAssignDialog({ program, onClose, onAssigned }: { program: Program; onClose: () => void; onAssigned: () => void }) {
  const [tab, setTab] = useState<"clients" | "slot">("clients");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [slotId, setSlotId] = useState<string>("");
  const [working, setWorking] = useState(false);
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["assignable-clients", program.id],
    queryFn: async () => {
      const [{ data: users }, { data: subs }, { data: assigns }, { data: slots }, { data: clientSlots }] = await Promise.all([
        supabase.from("users").select("id, name, email").eq("role", "client"),
        supabase.from("subscriptions").select("user_id, status, plan:plans(type)"),
        supabase.from("program_assignments").select("user_id, program_id, programs(name)").eq("active", true),
        supabase.from("slots").select("id, day_of_week, time, session_type").eq("active", true).order("day_of_week").order("time"),
        supabase.from("client_slots").select("user_id, slot_id"),
      ]);
      const subByUser = new Map((subs ?? []).map((s: any) => [s.user_id, s]));
      const assignByUser = new Map((assigns ?? []).map((a: any) => [a.user_id, a]));
      const eligibleUsers = (users ?? []).filter((u: any) => {
        const s: any = subByUser.get(u.id);
        if (!s) return false;
        if (!["active", "trialing"].includes(s.status)) return false;
        return s.plan?.type !== "mornings"; // exercise programs are for live-session plans
      });
      return { users: eligibleUsers, assignByUser, slots: slots ?? [], clientSlots: clientSlots ?? [] };
    },
  });

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data?.users ?? [];
    return (data?.users ?? []).filter((u: any) => (u.name ?? "").toLowerCase().includes(term) || (u.email ?? "").toLowerCase().includes(term));
  }, [data, search]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  async function assign() {
    let userIds: string[] = [];
    if (tab === "clients") {
      userIds = Array.from(selected);
    } else {
      if (!slotId) return toast.error("Pick a slot");
      const usersInSlot = (data?.clientSlots ?? []).filter((cs: any) => cs.slot_id === slotId).map((cs: any) => cs.user_id);
      const eligibleIds = new Set((data?.users ?? []).map((u: any) => u.id));
      userIds = usersInSlot.filter((id: string) => eligibleIds.has(id));
    }
    if (userIds.length === 0) return toast.error("No eligible clients selected");

    // Confirmation prompt for replacing existing assignments
    const replacing = userIds.filter((id) => data?.assignByUser.get(id) && (data!.assignByUser.get(id) as any).program_id !== program.id);
    if (replacing.length > 0) {
      if (!confirm(`${replacing.length} client(s) already have an active program. Replace it with "${program.name}"?`)) return;
    }

    setWorking(true);
    // Deactivate existing active assignments for these users
    const { error: deErr } = await supabase.from("program_assignments").update({ active: false }).in("user_id", userIds).eq("active", true);
    if (deErr) { setWorking(false); return toast.error(deErr.message); }
    const { error } = await supabase.from("program_assignments").insert(userIds.map((uid) => ({ user_id: uid, program_id: program.id, active: true })));
    setWorking(false);
    if (error) return toast.error(error.message);
    toast.success(`Assigned to ${userIds.length} client(s)`);
    onAssigned();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-lg bg-background border-l border-border h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Assign program</div>
            <h2 className="font-display text-2xl text-foreground">{program.name}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="flex gap-2 mb-4">
          {(["clients", "slot"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn(
              "rounded-full border px-3 py-1.5 text-xs",
              tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}>{t === "clients" ? "By client" : "By slot"}</button>
          ))}
        </div>

        {tab === "clients" ? (
          <>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients…" className="w-full mb-3 rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <div className="rounded-md border border-border max-h-[50vh] overflow-y-auto divide-y divide-border">
              {filteredUsers.map((u: any) => {
                const existing = data?.assignByUser.get(u.id) as any;
                return (
                  <label key={u.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-muted">
                    <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground truncate">{u.name || u.email}</div>
                      {existing && existing.program_id !== program.id && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400">Currently on: {existing.programs?.name}</div>
                      )}
                    </div>
                  </label>
                );
              })}
              {filteredUsers.length === 0 && <div className="p-4 text-xs text-muted-foreground text-center">No eligible clients.</div>}
            </div>
          </>
        ) : (
          <>
            <select value={slotId} onChange={(e) => setSlotId(e.target.value)} className="w-full mb-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">Pick a slot…</option>
              {(data?.slots ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>{DAYS[s.day_of_week]} {s.time.slice(0,5)} · {s.session_type}</option>
              ))}
            </select>
            {slotId && (
              <p className="text-xs text-muted-foreground">
                {(data?.clientSlots ?? []).filter((cs: any) => cs.slot_id === slotId).length} client(s) in this slot.
              </p>
            )}
          </>
        )}

        <button onClick={assign} disabled={working} className="mt-4 w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm hover:opacity-90 inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {working && <Loader2 size={14} className="animate-spin" />} Assign
        </button>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}
