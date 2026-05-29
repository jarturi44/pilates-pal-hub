import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  createCheckoutSession,
  createIntakeCheckout,
  syncIntakeCheckout,
} from "@/lib/checkout.functions";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Sparkles, Minus, Plus, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Search = { intake?: string; session_id?: string };

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    intake: typeof s.intake === "string" ? s.intake : undefined,
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: OnboardingPage,
});

type Plan = {
  id: string;
  type: "mornings" | "small_group" | "one_on_one" | "combo";
  display_name: string;
  sessions_per_week: number | null;
  price_per_month: number;
  stripe_price_id: string | null;
  includes_mornings: boolean;
};

type UserState = {
  intake_paid_at: string | null;
  intake_completed_at: string | null;
  onboarding_complete: boolean;
};

function OnboardingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/onboarding" });

  const intakeCheckout = useServerFn(createIntakeCheckout);
  const intakeSync = useServerFn(syncIntakeCheckout);
  const planCheckout = useServerFn(createCheckoutSession);

  const { data: userState, refetch: refetchUser } = useQuery({
    queryKey: ["onboarding-user-state", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<UserState> => {
      const { data, error } = await supabase
        .from("users")
        .select("intake_paid_at, intake_completed_at, onboarding_complete")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as UserState) ?? { intake_paid_at: null, intake_completed_at: null, onboarding_complete: false };
    },
  });

  const { data: activeSub, refetch: refetchSub } = useQuery({
    queryKey: ["onboarding-active-sub", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, status")
        .eq("user_id", user!.id)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // On return from Stripe intake checkout
  const handledIntake = useRef(false);
  useEffect(() => {
    if (search.intake !== "success" || !search.session_id) return;
    if (handledIntake.current) return;
    handledIntake.current = true;
    (async () => {
      try {
        const res = await intakeSync({ data: { sessionId: search.session_id! } });
        if (res?.paid) {
          toast.success("Payment received. Jon will reach out to schedule your intake.");
        }
      } catch (err) {
        console.error(err);
      } finally {
        await refetchUser();
        navigate({ to: "/onboarding", replace: true });
      }
    })();
  }, [search.intake, search.session_id, intakeSync, navigate, refetchUser]);

  // Once onboarding_complete is true, push them to /home
  useEffect(() => {
    if (userState?.onboarding_complete) {
      navigate({ to: "/home", replace: true });
    }
  }, [userState?.onboarding_complete, navigate]);

  if (!userState) {
    return (
      <div className="flex justify-center items-center gap-2 text-sm text-muted-foreground py-20">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  // Determine current step
  const needsIntakePayment = !userState.intake_paid_at;
  const awaitingIntakeSession = !!userState.intake_paid_at && !userState.intake_completed_at;
  const needsPlan = !!userState.intake_completed_at && !activeSub;
  const needsWaiver = !!activeSub && !userState.onboarding_complete;

  return (
    <div className="max-w-3xl mx-auto">
      <StepProgress
        current={
          needsIntakePayment ? 1 :
          awaitingIntakeSession ? 2 :
          needsPlan ? 3 :
          needsWaiver ? 4 : 4
        }
      />

      {needsIntakePayment && (
        <IntakePaymentStep
          onCheckout={async () => {
            try {
              const { url } = await intakeCheckout({ data: { returnUrl: window.location.origin } });
              if (window.top && window.top !== window.self) {
                (window.top as Window).location.href = url;
              } else {
                window.location.href = url;
              }
            } catch (err) {
              toast.error((err as Error).message || "Couldn't start checkout");
            }
          }}
        />
      )}

      {awaitingIntakeSession && <AwaitingIntakeStep onRefresh={() => refetchUser()} />}

      {needsPlan && (
        <PlanPickerStep
          onChoose={async (planId) => {
            try {
              const { url } = await planCheckout({ data: { planId, returnUrl: window.location.origin } });
              if (window.top && window.top !== window.self) {
                (window.top as Window).location.href = url;
              } else {
                window.location.href = url;
              }
            } catch (err) {
              toast.error((err as Error).message || "Couldn't start checkout");
            }
          }}
          onSubscribed={async () => {
            await refetchSub();
            qc.invalidateQueries({ queryKey: ["onboarding-gate"] });
          }}
        />
      )}

      {needsWaiver && (
        <ProceedToWaiverStep
          onContinue={() => navigate({ to: "/onboarding/setup" })}
        />
      )}
    </div>
  );
}

/* -------------------- Step components -------------------- */

function StepProgress({ current }: { current: number }) {
  const steps = ["Intake payment", "Intake session", "Choose plan", "Sign waiver"];
  return (
    <ol className="flex items-center gap-2 mb-10 text-xs text-muted-foreground">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={cn(
              "h-6 w-6 rounded-full inline-flex items-center justify-center text-[11px] font-medium",
              done ? "bg-primary text-primary-foreground" :
              active ? "bg-primary/15 text-primary border border-primary/40" :
              "bg-muted text-muted-foreground border border-border",
            )}>
              {done ? <CheckCircle2 size={12} /> : n}
            </span>
            <span className={cn(active ? "text-foreground font-medium" : "")}>{label}</span>
            {i < steps.length - 1 && <span className="mx-1 text-border">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

function IntakePaymentStep({ onCheckout }: { onCheckout: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium">Welcome</p>
        <h1 className="font-display text-4xl text-foreground mt-2">Let's start with your intake session.</h1>
        <p className="mt-3 text-muted-foreground">
          Before we build your program, we'll meet virtually for a 60-minute intake. We'll talk through your
          goals, how often you want to train, your availability, and any history I should know about.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-foreground">Initial intake session</h2>
            <p className="mt-1 text-sm text-muted-foreground">One-time payment · 60 minutes · virtual</p>
            <ul className="mt-4 space-y-2 text-sm text-foreground">
              <Bullet>Goals + frequency assessment</Bullet>
              <Bullet>Movement evaluation</Bullet>
              <Bullet>Personalized recommendation for your program</Bullet>
            </ul>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-4xl text-foreground">$60</div>
            <div className="text-xs text-muted-foreground">one-time</div>
          </div>
        </div>

        <button
          onClick={async () => { setBusy(true); try { await onCheckout(); } finally { setBusy(false); } }}
          disabled={busy}
          className="mt-6 w-full sm:w-auto rounded-md bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Pay $60 and book my intake <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function AwaitingIntakeStep({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium">Step 2 of 4</p>
        <h1 className="font-display text-4xl text-foreground mt-2">You're booked! 🎉</h1>
      </header>

      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto">
          <Sparkles size={26} />
        </div>
        <h2 className="font-display text-2xl text-foreground">Jon will reach out to schedule your intake</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Keep an eye on your inbox — Jon will email you within 1 business day to lock in a time for your
          virtual intake session. Once we've met and finalized your plan, you'll be able to log back in and
          finish setting up your account.
        </p>
        <button
          onClick={onRefresh}
          className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
        >
          Refresh status
        </button>
      </div>
    </div>
  );
}

function PlanPickerStep({
  onChoose,
  onSubscribed,
}: {
  onChoose: (planId: string) => Promise<void>;
  onSubscribed: () => void;
}) {
  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans").select("*").order("sessions_per_week", { ascending: true });
      if (error) throw error;
      return data as Plan[];
    },
  });

  const grouped = useMemo(() => {
    const out: Record<"mornings" | "small_group" | "one_on_one", Plan[]> = { mornings: [], small_group: [], one_on_one: [] };
    (plans ?? []).forEach((p) => {
      if (p.type === "mornings") out.mornings.push(p);
      else if (p.type === "small_group") out.small_group.push(p);
      else if (p.type === "one_on_one") out.one_on_one.push(p);
    });
    return out;
  }, [plans]);

  const morningsPlan = grouped.mornings[0] ?? null;
  const sgPlans = grouped.small_group.sort((a, b) => (a.sessions_per_week ?? 0) - (b.sessions_per_week ?? 0));
  const ooPlans = grouped.one_on_one.sort((a, b) => (a.sessions_per_week ?? 0) - (b.sessions_per_week ?? 0));

  const [sgQty, setSgQty] = useState(1);
  const [ooQty, setOoQty] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);

  const sgSelected = sgPlans.find((p) => p.sessions_per_week === sgQty) ?? sgPlans[0];
  const ooSelected = ooPlans.find((p) => p.sessions_per_week === ooQty) ?? ooPlans[0];

  async function choose(planId: string | undefined) {
    if (!planId) return;
    setBusy(planId);
    try {
      await onChoose(planId);
      onSubscribed();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium">Step 3 of 4</p>
        <h1 className="font-display text-4xl text-foreground mt-2">Choose your plan</h1>
        <p className="mt-2 text-muted-foreground">Pick what we discussed in your intake. You can change this later.</p>
      </header>

      <div className="grid gap-4">
        {/* 10 Minute Mornings */}
        {morningsPlan && (
          <PlanCard
            title="10 Minute Mornings"
            description="Daily 10-minute video sessions. Build the habit between live workouts."
            price={`$${Number(morningsPlan.price_per_month)}/mo`}
            disabled={busy === morningsPlan.id}
            onSelect={() => choose(morningsPlan.id)}
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
            disabled={busy === sgSelected.id}
            onSelect={() => choose(sgSelected.id)}
          />
        )}

        {/* One-On-One */}
        {ooPlans.length > 0 && ooSelected && (
          <QtyPlanCard
            title="One-On-One"
            description="Live private sessions with Jon. Includes equipment kit and Warm-Up library."
            qty={ooQty}
            setQty={setOoQty}
            maxQty={Math.max(...ooPlans.map((p) => p.sessions_per_week ?? 1))}
            label={`${ooQty} session${ooQty > 1 ? "s" : ""} / week`}
            price={`$${Number(ooSelected.price_per_month)}/mo`}
            disabled={busy === ooSelected.id}
            onSelect={() => choose(ooSelected.id)}
          />
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        All plans require a 3-month minimum commitment. You'll be billed monthly.
      </p>
    </div>
  );
}

function PlanCard({
  title, description, price, disabled, onSelect,
}: { title: string; description: string; price: string; disabled?: boolean; onSelect: () => void }) {
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
          disabled={disabled}
          className="rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {disabled && <Loader2 size={14} className="animate-spin" />}
          Select
        </button>
      </div>
    </article>
  );
}

function QtyPlanCard({
  title, description, qty, setQty, maxQty, label, price, disabled, onSelect,
}: {
  title: string; description: string;
  qty: number; setQty: (n: number) => void; maxQty: number; label: string;
  price: string; disabled?: boolean; onSelect: () => void;
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
          disabled={disabled}
          className="ml-auto rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {disabled && <Loader2 size={14} className="animate-spin" />}
          Select
        </button>
      </div>
    </article>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function ProceedToWaiverStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium">Step 4 of 4</p>
        <h1 className="font-display text-4xl text-foreground mt-2">One last thing — your waiver.</h1>
        <p className="mt-2 text-muted-foreground">Sign the liability waiver to unlock your home page.</p>
      </header>
      <button
        onClick={onContinue}
        className="rounded-md bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover:opacity-90 inline-flex items-center gap-2"
      >
        Continue to waiver <ArrowRight size={14} />
      </button>
    </div>
  );
}
