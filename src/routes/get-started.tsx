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
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);

  // If somehow already logged in, send them to their app
  useEffect(() => {
    if (session) {
      navigate({ to: role === "admin" ? "/dashboard" : "/portal", replace: true });
    }
  }, [session, role, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!acknowledged) return;
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
          Before we build your program, we'll meet virtually for a 60‑minute intake. We'll talk through your
          goals, how often you want to train, your availability, and any history I should know about.
        </p>

        <section className="mt-8 rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-foreground">Initial intake session</h2>
              <p className="mt-1 text-sm text-muted-foreground">One‑time payment · 60 minutes · virtual</p>
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

        <section className="mt-6 rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-display text-2xl text-foreground">Before you book</h2>
          <p className="text-sm text-foreground/90 leading-relaxed">
            Real change — feeling stronger, moving better, getting out of pain — doesn't happen in a session
            or two. It happens when you show up consistently over time. That's why I ask new clients to plan
            on at least 3 months together. We follow through on the things we commit to, and committing to
            yourself for 3 months is what makes this actually work. I'll be in your corner the whole way.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If you decide to move forward after your intake, all live‑session plans (One‑On‑One and Small Group)
            require a <strong className="text-foreground">3‑month minimum commitment</strong>, billed monthly.
            You can't cancel from within the app before the 3‑month period ends, and cancellation must be
            submitted in writing at least 3 weeks before the end of your billing cycle to avoid being charged
            for the following month.
          </p>
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

          <button
            type="submit" disabled={busy || !acknowledged || !name || !email}
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
