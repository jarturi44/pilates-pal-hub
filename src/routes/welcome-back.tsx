import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { markIntakeSkipped, linkExistingStripeSubscription } from "@/lib/existing-client.functions";
import { Wordmark } from "@/components/Wordmark";
import { toast } from "sonner";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/welcome-back")({
  head: () => ({
    meta: [
      { title: "Welcome back — Pilates with Jon" },
      { name: "description", content: "Set up your Pilates with Jon account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WelcomeBackPage,
  validateSearch: (search: Record<string, unknown>) => ({
    name: typeof search.name === "string" ? search.name : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
  }),
});

function WelcomeBackPage() {
  const { session, role } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const skipIntakeFn = useServerFn(markIntakeSkipped);
  const linkStripeFn = useServerFn(linkExistingStripeSubscription);

  const [name, setName] = useState(search.name ?? "");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);

  // If somehow already logged in, send them straight to onboarding
  useEffect(() => {
    if (session) {
      navigate({ to: role === "admin" ? "/dashboard" : "/onboarding", replace: true });
    }
  }, [session, role, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!acknowledged || !cameraReady) return;
    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();

      const { error: signUpErr } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: window.location.origin,
        },
      });
      if (signUpErr) {
        // Maybe they already have an account — try signing in.
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signInErr) throw new Error(signUpErr.message);
      }

      // Wait briefly for the handle_new_user trigger to land the users row
      await new Promise((r) => setTimeout(r, 400));

      await skipIntakeFn({});

      toast.success("Account created! Let's pick your plan.");
      navigate({ to: "/onboarding", replace: true });
    } catch (err) {
      toast.error((err as Error).message || "Couldn't create your account.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <Link to="/"><Wordmark size="md" showText /></Link>
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium">Existing clients</p>
        <h1 className="font-display text-4xl md:text-5xl text-foreground mt-3">
          Welcome back. Let's get you set up.
        </h1>
        <p className="mt-3 text-muted-foreground">
          We've already met — no intake session needed. Create your account below, then pick the plan we
          discussed and sign your waiver.
        </p>

        <section className="mt-8 rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-display text-2xl text-foreground">A couple of reminders</h2>
          <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
            <p>
              <strong className="text-foreground">3‑month minimum commitment.</strong> All live‑session
              plans (One‑On‑One and Small Group) are billed monthly with a 3‑month minimum. You can't
              cancel from within the app before the 3 months end, and cancellation must be submitted in
              writing at least 3 weeks before the end of your billing cycle to avoid being charged for
              the following month.
            </p>
            <p>
              <strong className="text-foreground">Camera & lighting setup.</strong> For live sessions, I
              need to see your full body clearly. Please make sure you have a spot with good lighting
              and enough room for your camera (phone, tablet, or laptop) to capture you head‑to‑toe.
              <em className="block mt-1 text-xs">(Not required if you're signing up for 10 Minute Mornings only.)</em>
            </p>
          </div>
        </section>

        <form onSubmit={onSubmit} className="mt-6 rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-display text-2xl text-foreground">Create your account</h2>

          <div>
            <label className="text-sm font-medium text-foreground">Name</label>
            <input
              type="text" required value={name} onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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

          <label className="flex items-start gap-3 cursor-pointer pt-2">
            <input
              type="checkbox" checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm text-foreground">
              I understand and acknowledge the 3‑month minimum commitment for live‑session plans.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox" checked={cameraReady}
              onChange={(e) => setCameraReady(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm text-foreground">
              I have a workout space with good lighting and room for my camera to capture my full body
              head‑to‑toe <span className="text-muted-foreground">(or I'm signing up for 10 Minute Mornings only)</span>.
            </span>
          </label>

          <button
            type="submit" disabled={busy || !acknowledged || !cameraReady || !name || !email || password.length < 8}
            className="mt-2 w-full sm:w-auto rounded-md bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Create my account <ArrowRight size={14} />
          </button>

          <p className="text-xs text-muted-foreground flex items-start gap-2 pt-1">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-accent shrink-0" />
            <span>Next you'll choose your plan and sign the waiver.</span>
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </main>
    </div>
  );
}
