
function IntakeSection({ user, onChanged }: { user: any; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  async function markComplete() {
    setBusy(true);
    const { error } = await supabase
      .from("users")
      .update({ intake_completed_at: new Date().toISOString() })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Intake marked complete");
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
