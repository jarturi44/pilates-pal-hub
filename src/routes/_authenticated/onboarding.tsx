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
  syncCheckoutSession,
  subscribeWithSavedCard,
} from "@/lib/checkout.functions";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Sparkles, Minus, Plus, ArrowRight, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

type Search = { intake?: string; session_id?: string; welcomeBack?: string; step?: string; plan_id?: string };

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    intake: typeof s.intake === "string" ? s.intake : undefined,
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
    welcomeBack: typeof s.welcomeBack === "string" ? s.welcomeBack : undefined,
    step: typeof s.step === "string" ? s.step : undefined,
    plan_id: typeof s.plan_id === "string" ? s.plan_id : undefined,
  }),
  component: OnboardingPage,
});


type Plan = {
  id: string;
  type: "mornings" | "small_group" | "one_on_one" | "combo";
  display_name: string;
  sessions_per_week: number | null;
  price_per_month: number;
  includes_mornings: boolean;
};

type ActiveSub = {
  id: string;
  status: string;
  plan_id: string;
  plan: { type: Plan["type"] } | null;
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
  const planSync = useServerFn(syncCheckoutSession);
  const subscribeSaved = useServerFn(subscribeWithSavedCard);


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
        .select("id, status, plan_id, plan:plans(type)")
        .eq("user_id", user!.id)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ActiveSub | null;
    },
  });

  const { data: shippingDone, refetch: refetchShipping } = useQuery({
    queryKey: ["onboarding-shipping", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("onboarding_progress")
        .select("shipping_completed_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data?.shipping_completed_at;
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

  // On return from Stripe subscription checkout
  const handledSub = useRef(false);
  useEffect(() => {
    if (search.step !== "sub_success" || !search.session_id) return;
    if (handledSub.current) return;
    handledSub.current = true;
    (async () => {
      try {
        const res = await planSync({ data: { sessionId: search.session_id! } });
        if (res?.subscription) {
          toast.success("You're enrolled! Let's get your equipment shipped.");
        }
      } catch (err) {
        console.error(err);
      } finally {
        await refetchSub();
        qc.invalidateQueries({ queryKey: ["onboarding-gate"] });
        navigate({ to: "/onboarding", replace: true });
      }
    })();
  }, [search.step, search.session_id, planSync, navigate, refetchSub, qc]);


  // Only redirect to /portal when onboarding is truly complete — shipping AND
  // waiver both done. Guards against stale onboarding_complete flags that
  // predate the shipping/waiver requirement (which would otherwise trap the
  // user in a redirect loop away from the steps they still need to finish).
  const { data: waiverDone } = useQuery({
    queryKey: ["onboarding-waiver-done", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("onboarding_progress")
        .select("waiver_completed_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data?.waiver_completed_at;
    },
  });
  useEffect(() => {
    if (userState?.onboarding_complete && shippingDone && waiverDone) {
      navigate({ to: "/portal", replace: true });
    }
  }, [userState?.onboarding_complete, shippingDone, waiverDone, navigate]);

  if (!userState) {
    return (
      <div className="flex justify-center items-center gap-2 text-sm text-muted-foreground py-20">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  // Determine current step
  const planType = activeSub?.plan?.type ?? null;
  const planNeedsEquipment = planType === "small_group" || planType === "one_on_one" || planType === "combo";

  const isWelcomeBack = search.welcomeBack === "1";

  // Existing-client "welcome back" flow skips intake payment + session entirely,
  // regardless of what user_state reports (avoids race with the skip-intake RPC).
  const needsIntakePayment = !isWelcomeBack && !userState.intake_paid_at;
  const awaitingIntakeSession = !isWelcomeBack && !!userState.intake_paid_at && !userState.intake_completed_at;
  const needsPlan = (isWelcomeBack || !!userState.intake_completed_at) && !activeSub;
  const needsShipping = !!activeSub && planNeedsEquipment && !shippingDone;
  const needsWaiver = !!activeSub && !needsShipping && !userState.onboarding_complete;

  const steps = isWelcomeBack
    ? ["Choose plan", "Shipping info", "Sign waiver"]
    : ["Intake payment", "Intake session", "Choose plan", "Shipping info", "Sign waiver"];

  const current = isWelcomeBack
    ? (needsPlan ? 0 : needsShipping ? 1 : 2)
    : (needsIntakePayment ? 0 : awaitingIntakeSession ? 1 : needsPlan ? 2 : needsShipping ? 3 : 4);

  return (
    <div className="max-w-3xl mx-auto">
      <StepProgress steps={steps} current={current} />

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
          stepLabel={isWelcomeBack ? "Step 1 of 3" : "Step 3 of 5"}
          onChoose={async (planId) => {
            try {
              // Try to charge the saved card from the intake payment.
              const res = await subscribeSaved({ data: { planId } });
              if (res.requiresCheckout) {
                // Fallback: send to Stripe Checkout if no saved card on file.
                const { url } = await planCheckout({ data: { planId, returnUrl: window.location.origin } });
                if (window.top && window.top !== window.self) {
                  (window.top as Window).location.href = url;
                } else {
                  window.location.href = url;
                }
                return;
              }
              toast.success("You're enrolled! Let's get your equipment shipped.");
              await refetchSub();
              qc.invalidateQueries({ queryKey: ["onboarding-gate"] });
            } catch (err) {
              toast.error((err as Error).message || "Couldn't start your plan");
            }
          }}
          onSubscribed={async () => {
            await refetchSub();
            qc.invalidateQueries({ queryKey: ["onboarding-gate"] });
          }}
        />
      )}

      {needsShipping && (
        <ShippingStep
          userId={user!.id}
          stepLabel={isWelcomeBack ? "Step 2 of 3" : "Step 4 of 5"}
          onSaved={async () => {
            await refetchShipping();
          }}
        />
      )}

      {needsWaiver && (
        <ProceedToWaiverStep
          stepLabel={isWelcomeBack ? "Step 3 of 3" : "Step 5 of 5"}
          onContinue={() => navigate({ to: "/onboarding/setup" })}
        />
      )}
    </div>
  );
}

/* -------------------- Step components -------------------- */

function StepProgress({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2 mb-10 text-xs text-muted-foreground">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={cn(
              "h-6 w-6 rounded-full inline-flex items-center justify-center text-[11px] font-medium",
              done ? "bg-primary text-primary-foreground" :
              active ? "bg-primary/15 text-primary border border-primary/40" :
              "bg-muted text-muted-foreground border border-border",
            )}>
              {done ? <CheckCircle2 size={12} /> : i + 1}
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
          Before we build your program, we'll meet virtually for a 45-minute intake. We'll talk through your
          goals, how often you want to train, your availability, and any history I should know about.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-foreground">Initial intake session</h2>
            <p className="mt-1 text-sm text-muted-foreground">One-time payment · 45 minutes · virtual</p>
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

function AwaitingIntakeStep({ onRefresh, stepLabel = "Step 2 of 5" }: { onRefresh: () => void; stepLabel?: string }) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium">{stepLabel}</p>
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
  stepLabel = "Step 3 of 5",
}: {
  onChoose: (planId: string) => Promise<void>;
  onSubscribed: () => void;
  stepLabel?: string;
}) {
  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, type, sessions_per_week, price_per_month, includes_mornings, display_name, created_at")
        .order("sessions_per_week", { ascending: true });
      if (error) throw error;
      return data as Plan[];
    },
  });

  const grouped = useMemo(() => {
    const out: Record<"mornings" | "small_group" | "one_on_one" | "combo", Plan[]> = { mornings: [], small_group: [], one_on_one: [], combo: [] };
    (plans ?? []).forEach((p) => {
      if (p.type === "mornings") out.mornings.push(p);
      else if (p.type === "small_group") out.small_group.push(p);
      else if (p.type === "one_on_one") out.one_on_one.push(p);
      else if (p.type === "combo") out.combo.push(p);
    });
    return out;
  }, [plans]);

  const morningsPlan = grouped.mornings[0] ?? null;
  const sgPlans = grouped.small_group.sort((a, b) => (a.sessions_per_week ?? 0) - (b.sessions_per_week ?? 0));
  const ooPlans = grouped.one_on_one.sort((a, b) => (a.sessions_per_week ?? 0) - (b.sessions_per_week ?? 0));
  const comboPlans = grouped.combo.sort((a, b) => Number(a.price_per_month) - Number(b.price_per_month));

  const [sgQty, setSgQty] = useState(1);
  const [ooQty, setOoQty] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const sgSelected = sgPlans.find((p) => p.sessions_per_week === sgQty) ?? sgPlans[0];
  const ooSelected = ooPlans.find((p) => p.sessions_per_week === ooQty) ?? ooPlans[0];

  async function choose(planId: string | undefined) {
    if (!planId) return;
    if (!acknowledged) {
      toast.error("Please acknowledge the 3-month commitment below to continue.");
      return;
    }
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
        <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium">{stepLabel}</p>
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
                  disabled={busy === p.id}
                  onSelect={() => choose(p.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-sm text-foreground leading-relaxed">
            I understand and acknowledge the <strong>3‑month minimum commitment</strong> for live‑session
            plans (One‑On‑One and Small Group), billed monthly. Cancellation must be submitted in writing
            at least 3 weeks before the end of my billing cycle to avoid being charged for the following month.
          </span>
        </label>
      </div>
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

function ProceedToWaiverStep({ onContinue, stepLabel = "Step 5 of 5" }: { onContinue: () => void; stepLabel?: string }) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium">{stepLabel}</p>
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

function ShippingStep({ userId, onSaved, stepLabel = "Step 4 of 5" }: { userId: string; onSaved: () => Promise<void>; stepLabel?: string }) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zip: "",
  });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [efRes, uRes] = await Promise.all([
        supabase
          .from("equipment_fulfillment")
          .select("first_name, last_name, phone, street, city, state, zip")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase.from("users").select("name").eq("id", userId).maybeSingle(),
      ]);
      const ef = efRes.data;
      const nameParts = (uRes.data?.name ?? "").split(/\s+/);
      setForm((f) => ({
        first_name: ef?.first_name ?? nameParts[0] ?? f.first_name,
        last_name: ef?.last_name ?? nameParts.slice(1).join(" ") ?? f.last_name,
        phone: ef?.phone ?? f.phone,
        street: ef?.street ?? f.street,
        city: ef?.city ?? f.city,
        state: ef?.state ?? f.state,
        zip: ef?.zip ?? f.zip,
      }));
      setLoaded(true);
    })();
  }, [userId]);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const required: (keyof typeof form)[] = ["first_name", "last_name", "phone", "street", "city", "state", "zip"];
    for (const k of required) {
      if (!form[k].trim()) {
        toast.error("Please fill in every field.");
        return;
      }
    }
    setBusy(true);
    try {
      const composed = `${form.first_name} ${form.last_name}\nPhone: ${form.phone}\n${form.street}\n${form.city}, ${form.state} ${form.zip}`;
      const { error: efErr } = await supabase
        .from("equipment_fulfillment")
        .upsert(
          {
            user_id: userId,
            first_name: form.first_name,
            last_name: form.last_name,
            phone: form.phone,
            street: form.street,
            city: form.city,
            state: form.state,
            zip: form.zip,
            shipping_address: composed,
          },
          { onConflict: "user_id" },
        );
      if (efErr) throw efErr;
      const { error: opErr } = await supabase
        .from("onboarding_progress")
        .upsert(
          { user_id: userId, shipping_completed_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (opErr) throw opErr;
      toast.success("Shipping info saved. We'll get your equipment out shortly.");
      await onSaved();
    } catch (err) {
      toast.error((err as Error).message || "Couldn't save shipping info");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium">{stepLabel}</p>
        <h1 className="font-display text-4xl text-foreground mt-2">Where should we ship your equipment?</h1>
        <p className="mt-2 text-muted-foreground">
          Your plan includes a starter equipment kit. Enter the address you'd like it shipped to.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Truck size={16} className="text-primary" />
          <span className="font-medium">Shipping address</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="First name" value={form.first_name} onChange={(v) => update("first_name", v)} disabled={!loaded || busy} />
          <Field label="Last name" value={form.last_name} onChange={(v) => update("last_name", v)} disabled={!loaded || busy} />
        </div>
        <Field label="Phone" value={form.phone} onChange={(v) => update("phone", v)} disabled={!loaded || busy} type="tel" />
        <Field label="Street address" value={form.street} onChange={(v) => update("street", v)} disabled={!loaded || busy} />
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="col-span-2 sm:col-span-3">
            <Field label="City" value={form.city} onChange={(v) => update("city", v)} disabled={!loaded || busy} />
          </div>
          <div className="col-span-1 sm:col-span-1">
            <Field label="State" value={form.state} onChange={(v) => update("state", v)} disabled={!loaded || busy} />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <Field label="ZIP" value={form.zip} onChange={(v) => update("zip", v)} disabled={!loaded || busy} />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || !loaded}
          className="mt-2 w-full sm:w-auto rounded-md bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Save and continue <ArrowRight size={14} />
        </button>
      </div>
    </form>
  );
}

function Field({
  label, value, onChange, disabled, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; type?: string }) {
  return (
    <label className="block">
      <span className="block text-xs text-muted-foreground mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
    </label>
  );
}
