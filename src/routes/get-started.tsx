import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { createPublicIntakeCheckout } from "@/lib/intake-public.functions";
import { Wordmark } from "@/components/Wordmark";
import { toast } from "sonner";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/get-started")({
  head: () => ({
    meta: [
      { title: "Book your intake — Pilates with Jon" },
      { name: "description", content: "Start with a $60 virtual intake session. Pay first, then create your account." },
    ],
  }),
  component: GetStartedPage,
});

function GetStartedPage() {
  const { session, role } = useAuth();
  const navigate = useNavigate();
  const checkoutFn = useServerFn(createPublicIntakeCheckout);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  // If somehow already logged in, send them to their app
  useEffect(() => {
    if (session) {
      navigate({ to: role === "admin" ? "/dashboard" : "/portal", replace: true });
    }
  }, [session, role, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { url } = await checkoutFn({
        data: { name: name.trim(), email: email.trim().toLowerCase(), returnUrl: window.location.origin },
      });
      if (window.top && window.top !== window.self) {
        (window.top as Window).location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (err) {
      toast.error((err as Error).message || "Couldn't start checkout");
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
        <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium">Step 1 of 2 · Book your intake</p>
        <h1 className="font-display text-4xl md:text-5xl text-foreground mt-3">
          Let's start with your intake session.
        </h1>
        <p className="mt-3 text-muted-foreground">
          We'll meet virtually for a 45 minute intake. I'll listen intently to your history, areas of focus, and goals. We'll pick a plan that's right for your life, health and best future you!
        </p>

        <section className="mt-8 rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-foreground">Initial intake session</h2>
              <p className="mt-1 text-sm text-muted-foreground">One‑time payment · 45 minutes · virtual</p>
              <ul className="mt-4 space-y-2 text-sm text-foreground">
                <Bullet>Goals + frequency assessment</Bullet>
                <Bullet>Movement evaluation</Bullet>
                <Bullet>Personalized recommendation for your program</Bullet>
              </ul>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display text-4xl text-foreground">$60</div>
              <div className="text-xs text-muted-foreground">one‑time</div>
            </div>
          </div>
        </section>

        <form onSubmit={onSubmit} className="mt-6 rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-display text-2xl text-foreground">Your info</h2>
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
            <p className="mt-1 text-xs text-muted-foreground">
              You'll create your account with this email after payment.
            </p>
          </div>

          <button
            type="submit" disabled={busy || !name || !email}
            className="mt-2 w-full sm:w-auto rounded-md bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Pay $60 and book my intake <ArrowRight size={14} />
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already paid?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </main>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
      <span>{children}</span>
    </li>
  );
}
