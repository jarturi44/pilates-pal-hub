import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getIntakeSessionInfo,
  getIntakeInfoByResumeToken,
  claimIntakeForUser,
} from "@/lib/intake-public.functions";
import { Wordmark } from "@/components/Wordmark";
import { toast } from "sonner";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

type Search = { session_id?: string; resume?: string };

export const Route = createFileRoute("/onboarding_/create-account")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
    resume: typeof s.resume === "string" ? s.resume : undefined,
  }),
  component: CreateAccountPage,
});

function CreateAccountPage() {
  const { session_id, resume } = Route.useSearch();
  const navigate = useNavigate();
  const getInfoBySession = useServerFn(getIntakeSessionInfo);
  const getInfoByToken = useServerFn(getIntakeInfoByResumeToken);
  const claimFn = useServerFn(claimIntakeForUser);

  const { data: info, error, isLoading } = useQuery({
    queryKey: ["intake-info", session_id, resume],
    queryFn: async () => {
      if (session_id) return await getInfoBySession({ data: { sessionId: session_id } });
      if (resume) return await getInfoByToken({ data: { token: resume } });
      throw new Error("Missing session id or resume token.");
    },
    retry: 1,
  });

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (info?.name && !name) setName(info.name);
  }, [info?.name, name]);

  // If already logged in, send to /onboarding
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/onboarding", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!info) return;
    setBusy(true);
    try {
      // Try sign up first; if account already exists, sign in.
      const { error: signUpErr } = await supabase.auth.signUp({
        email: info.email,
        password,
        options: {
          data: { name: name.trim() || info.name || "" },
          emailRedirectTo: window.location.origin,
        },
      });
      if (signUpErr) {
        // If the user already exists, try signing them in with the same password.
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: info.email, password,
        });
        if (signInErr) throw new Error(signUpErr.message);
      }

      // Wait briefly for the handle_new_user trigger to land the users row
      await new Promise((r) => setTimeout(r, 400));

      await claimFn({
        data: {
          sessionId: session_id,
          resumeToken: resume,
          email: info.email,
        },
      });

      toast.success("Account created! Welcome.");
      navigate({ to: "/onboarding", replace: true });
    } catch (err) {
      toast.error((err as Error).message || "Couldn't finish setting up your account.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <Link to="/"><Wordmark size="md" showText /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium">Step 2 of 2 · Create your account</p>
        <h1 className="font-display text-4xl text-foreground mt-3">You're in! 🎉</h1>
        <p className="mt-3 text-muted-foreground">
          Payment received. Set a password to finish creating your account — Jon will reach out shortly to
          schedule your intake.
        </p>

        {isLoading && (
          <div className="mt-8 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Verifying your payment…
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        {info && (
          <>
            {info.alreadyClaimed && (
              <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900">
                This payment already has an account. <Link to="/login" className="font-semibold underline">Sign in instead</Link>.
              </div>
            )}

            <form onSubmit={onSubmit} className="mt-6 space-y-4 bg-card border border-border rounded-xl p-6">
              <div>
                <label className="text-sm font-medium text-foreground">Email</label>
                <input
                  type="email" disabled value={info.email}
                  className="mt-1 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Locked to the email you paid with.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Name</label>
                <input
                  type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Password</label>
                <input
                  type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
              </div>
              <button
                type="submit" disabled={busy || info.alreadyClaimed}
                className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                Create my account <ArrowRight size={14} />
              </button>
              <p className="text-xs text-muted-foreground flex items-start gap-2 pt-1">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-accent shrink-0" />
                <span>Your intake payment is already secured — finishing here just gives you the account to log into.</span>
              </p>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
