import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
});

type State =
  | { kind: "loading" }
  | { kind: "valid" }
  | { kind: "already" }
  | { kind: "invalid" }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

function UnsubscribePage() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) return setState({ kind: "invalid" });
        if (body.valid === false && body.reason === "already_unsubscribed") return setState({ kind: "already" });
        if (body.valid) return setState({ kind: "valid" });
        setState({ kind: "invalid" });
      })
      .catch(() => setState({ kind: "invalid" }));
  }, [token]);

  async function confirm() {
    setState({ kind: "submitting" });
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return setState({ kind: "error", message: body.error || "Failed to unsubscribe" });
      if (body.success) return setState({ kind: "done" });
      if (body.reason === "already_unsubscribed") return setState({ kind: "already" });
      setState({ kind: "error", message: "Failed to unsubscribe" });
    } catch (e: any) {
      setState({ kind: "error", message: e?.message ?? "Network error" });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="font-display text-3xl text-foreground mb-2">Unsubscribe</h1>

        {state.kind === "loading" && (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2 justify-center">
            <Loader2 size={14} className="animate-spin" /> Validating link…
          </p>
        )}

        {state.kind === "valid" && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Confirm to stop receiving emails at this address.
            </p>
            <button
              onClick={confirm}
              className="rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90"
            >
              Confirm unsubscribe
            </button>
          </>
        )}

        {state.kind === "submitting" && (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2 justify-center">
            <Loader2 size={14} className="animate-spin" /> Processing…
          </p>
        )}

        {state.kind === "done" && (
          <p className="text-sm text-foreground">You've been unsubscribed. We won't email you again.</p>
        )}

        {state.kind === "already" && (
          <p className="text-sm text-muted-foreground">This address is already unsubscribed.</p>
        )}

        {state.kind === "invalid" && (
          <p className="text-sm text-muted-foreground">This unsubscribe link is invalid or expired.</p>
        )}

        {state.kind === "error" && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}

        <div className="mt-8">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground underline">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
