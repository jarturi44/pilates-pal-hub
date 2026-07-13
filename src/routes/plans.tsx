import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { getPublicPlans, type PublicPlan } from "@/lib/plans-public.functions";
import { Wordmark } from "@/components/Wordmark";
import { ArrowRight, CheckCircle2, Minus, Plus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "Plans & Pricing — Pilates with Jon" },
      {
        name: "description",
        content:
          "See every Pilates with Jon program and price — 10 Minute Mornings, Small Group, and One-On-One (1–3× a week). Every journey starts with a virtual intake.",
      },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  const { session, role } = useAuth();
  const navigate = useNavigate();
  const plansFn = useServerFn(getPublicPlans);

  // Where a "Choose this plan" button sends someone. Prospects (not logged in)
  // go to the intake booking page first — you can't pick a plan until you've
  // had your intake. A logged-in client goes to the onboarding gate, which
  // routes them to intake payment or the real (chargeable) plan picker
  // depending on how far along they are. Admins go to their dashboard.
  const planCtaTarget: "/get-started" | "/onboarding" | "/dashboard" = !session
    ? "/get-started"
    : role === "admin"
      ? "/dashboard"
      : "/onboarding";

  function goToStart() {
    navigate({ to: planCtaTarget });
  }

  const { data: plans, isPending } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => plansFn(),
    staleTime: 5 * 60 * 1000,
  });

  const grouped = useMemo(() => {
    const out: Record<PublicPlan["type"], PublicPlan[]> = {
      mornings: [],
      small_group: [],
      one_on_one: [],
      combo: [],
    };
    (plans ?? []).forEach((p) => out[p.type]?.push(p));
    return out;
  }, [plans]);

  const morningsPlan = grouped.mornings[0] ?? null;
  const sgPlans = [...grouped.small_group].sort(
    (a, b) => (a.sessions_per_week ?? 0) - (b.sessions_per_week ?? 0),
  );
  const ooPlans = [...grouped.one_on_one].sort(
    (a, b) => (a.sessions_per_week ?? 0) - (b.sessions_per_week ?? 0),
  );
  const comboPlans = [...grouped.combo].sort(
    (a, b) => Number(a.price_per_month) - Number(b.price_per_month),
  );

  const [sgQty, setSgQty] = useState(1);
  const [ooQty, setOoQty] = useState(1);
  const sgSelected = sgPlans.find((p) => p.sessions_per_week === sgQty) ?? sgPlans[0];
  const ooSelected = ooPlans.find((p) => p.sessions_per_week === ooQty) ?? ooPlans[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link to="/"><Wordmark size="md" showText /></Link>
          <div className="flex items-center gap-3">
            {session ? (
              <Link
                to={role === "admin" ? "/dashboard" : "/onboarding"}
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
              >
                Open app
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-foreground hover:text-primary">
                  Sign in
                </Link>
                <Link
                  to="/get-started"
                  className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium">Plans &amp; Pricing</p>
        <h1 className="font-display text-4xl md:text-5xl text-foreground mt-3">
          Find the plan that fits your life.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Live one-on-one and small-group Pilates, plus daily 10-minute videos to keep the habit
          going between sessions. Pick how often you want to move each week — you can always
          adjust later.
        </p>

        {/* Intake-first framing */}
        <section className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-accent" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Every journey starts with an intake</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Before your first plan, we meet virtually for a 45-minute intake ($60) so I can learn
                your history, goals, and how you move — then help you choose the right plan below.
                Choosing a plan here takes you to book that intake first.
              </p>
            </div>
          </div>
        </section>

        {isPending ? (
          <div className="mt-8 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading plans…
          </div>
        ) : (
          <div className="mt-8 grid gap-4">
            {/* 10 Minute Mornings */}
            {morningsPlan && (
              <PlanCard
                title="10 Minute Mornings"
                description="Daily 10-minute video sessions. Build the habit on your own — a great standalone start, or a supplement to your live workouts."
                price={`$${Number(morningsPlan.price_per_month)}/mo`}
                onSelect={goToStart}
              />
            )}

            {/* Small Group */}
            {sgPlans.length > 0 && sgSelected && (
              <QtyPlanCard
                title="Small Group"
                description="Live small-group sessions with Jon. Includes equipment kit and Warm-Up library."
                qty={sgQty}
                setQty={setSgQty}
                maxQty={Math.max(...sgPlans.map((p) => p.sessions_per_week ?? 1))}
                label={`${sgQty} session${sgQty > 1 ? "s" : ""} / week`}
                price={`$${Number(sgSelected.price_per_month)}/mo`}
                onSelect={goToStart}
              />
            )}

            {/* One-On-One */}
            {ooPlans.length > 0 && ooSelected && (
              <QtyPlanCard
                title="One-On-One"
                description="Live private sessions with Jon, fully tailored to you. Includes equipment kit and Warm-Up library."
                qty={ooQty}
                setQty={setOoQty}
                maxQty={Math.max(...ooPlans.map((p) => p.sessions_per_week ?? 1))}
                label={`${ooQty} session${ooQty > 1 ? "s" : ""} / week`}
                price={`$${Number(ooSelected.price_per_month)}/mo`}
                onSelect={goToStart}
              />
            )}

            {/* Combo */}
            {comboPlans.length > 0 && (
              <div className="space-y-3">
                {comboPlans.map((p) => {
                  const [title, description] = p.display_name.includes(":")
                    ? [p.display_name.split(":")[0].trim(), p.display_name.split(":").slice(1).join(":").trim()]
                    : [p.display_name, "Mix of Small Group and One-On-One sessions. Includes equipment kit and Warm-Up library."];
                  return (
                    <PlanCard
                      key={p.id}
                      title={title}
                      description={description}
                      price={`$${Number(p.price_per_month)}/mo`}
                      onSelect={goToStart}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Commitment note */}
        <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
          Live-session plans (One-On-One and Small Group) have a 3-month minimum commitment, billed
          monthly — that's how long it takes to really feel the change. Cancellation must be submitted
          in writing at least 3 weeks before the end of your billing cycle.
        </p>

        {/* Bottom CTA */}
        <div className="mt-8 rounded-xl border border-border bg-card p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-foreground">Ready to begin?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Book your intake and we'll pick the right plan together.
            </p>
          </div>
          <button
            onClick={goToStart}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-action text-action-foreground px-6 py-3 text-sm font-semibold hover:opacity-90"
          >
            Book your intake <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already a client?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </main>
    </div>
  );
}

function PlanCard({
  title, description, price, onSelect,
}: { title: string; description: string; price: string; onSelect: () => void }) {
  return (
    <article className="rounded-xl border border-border bg-card p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex-1">
        <h3 className="font-display text-2xl text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="font-display text-2xl text-foreground">{price}</div>
        </div>
        <button
          onClick={onSelect}
          className="rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90 inline-flex items-center gap-2 whitespace-nowrap"
        >
          Choose this plan
        </button>
      </div>
    </article>
  );
}

function QtyPlanCard({
  title, description, qty, setQty, maxQty, label, price, onSelect,
}: {
  title: string; description: string;
  qty: number; setQty: (n: number) => void; maxQty: number; label: string;
  price: string; onSelect: () => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-display text-2xl text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl text-foreground">{price}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sessions/week:</span>
          <div className="inline-flex items-center rounded-md border border-border">
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              disabled={qty <= 1}
              className="h-9 w-9 inline-flex items-center justify-center hover:bg-muted disabled:opacity-40"
              aria-label="Decrease"
            >
              <Minus size={14} />
            </button>
            <span className="h-9 w-10 inline-flex items-center justify-center text-sm font-medium text-foreground border-x border-border">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty(Math.min(maxQty, qty + 1))}
              disabled={qty >= maxQty}
              className="h-9 w-9 inline-flex items-center justify-center hover:bg-muted disabled:opacity-40"
              aria-label="Increase"
            >
              <Plus size={14} />
            </button>
          </div>
          <span className="text-xs text-muted-foreground">({label})</span>
        </div>
        <button
          onClick={onSelect}
          className="ml-auto rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90 inline-flex items-center gap-2 whitespace-nowrap"
        >
          Choose this plan
        </button>
      </div>
    </article>
  );
}
