import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { createCheckoutSession, syncCheckoutSession } from "@/lib/checkout.functions";
import { toast } from "sonner";
import { Check, Loader2, PackageCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Step =
  | "plan"
  | "shipping"
  | "commitment"
  | "checkout"
  | "success"
  | "welcome"
  | "intake"
  | "waiver"
  | "done";

type Search = { step?: Step; session_id?: string; plan_id?: string };

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    step: (s.step as Step) ?? "plan",
    session_id: s.session_id as string | undefined,
    plan_id: s.plan_id as string | undefined,
  }),
  component: OnboardingPage,
});

type Plan = {
  id: string;
  type: "mornings" | "semi_private" | "private" | "combo";
  display_name: string;
  sessions_per_week: number | null;
  price_per_month: number;
  stripe_price_id: string;
  includes_mornings: boolean;
};

const tierMeta: Record<Plan["type"], { label: string; description: string }> = {
  mornings: { label: "10 Minute Mornings", description: "Digital video library. Start every day with a short guided session." },
  semi_private: { label: "Semi-Private", description: "Small group, live sessions. Includes Warm Up Video Library." },
  private: { label: "Private", description: "One-on-one live sessions. Includes Warm Up Video Library." },
  combo: { label: "Combo", description: "Mix of private and semi-private. Includes Warm Up Video Library." },
};

const WAIVER_TEXT = `LIABILITY WAIVER & RELEASE OF CLAIMS — Pilates with Jon

In consideration of being permitted to participate in any Pilates classes, sessions, programs, video content, or related activities (collectively, the "Services") provided by Pilates with Jon ("the Studio"), I, the undersigned participant, acknowledge and agree to the following terms:

1. ASSUMPTION OF RISK. I understand that participation in Pilates and related fitness activities involves inherent risks, including but not limited to muscle strains, sprains, joint injuries, falls, fractures, cardiovascular events, and aggravation of pre-existing conditions. I voluntarily assume all such risks, both known and unknown, even if arising from the negligence of the Studio or others.

2. PHYSICAL CONDITION. I represent that I am in good physical health and have no medical condition that would prevent my safe participation. I have consulted my physician if I have any doubt about my ability to participate. I will immediately notify my instructor of any injury, pain, dizziness, or discomfort during any session.

3. EQUIPMENT. I understand that I may be provided with equipment (foam roller, Pilates ring, resistance bands, stretch strap, door anchors). I agree to use this equipment only as instructed and acknowledge that improper use can result in serious injury or property damage.

4. RELEASE OF LIABILITY. I, on behalf of myself, my heirs, executors, and assigns, hereby release, waive, and discharge the Studio, its owners, instructors, employees, and agents from any and all claims, demands, or causes of action arising out of or related to my participation in the Services.

5. MEDIA RELEASE. I grant the Studio permission to use my likeness in photographs or video for promotional purposes unless I notify the Studio in writing otherwise.

6. ACKNOWLEDGEMENT. I have read this entire waiver, understand its contents, and sign it freely and voluntarily. I understand that this is a legally binding agreement.

By typing my full legal name below and checking the boxes, I confirm that I have read, understood, and agreed to all the terms above.`;

function OnboardingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const startCheckout = useServerFn(createCheckoutSession);
  const syncCheckout = useServerFn(syncCheckoutSession);
  const search = useSearch({ from: "/_authenticated/onboarding" });
  const step = search.step ?? "plan";

  // Pre-checkout state
  const [address, setAddress] = useState({ line1: "", line2: "", city: "", region: "", postal: "", country: "" });
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fallbackPlanId, setFallbackPlanId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem("onboarding:selected-plan-id");
  });
  const selectedPlanId = search.plan_id ?? fallbackPlanId;

  useEffect(() => {
    if (!search.plan_id || search.plan_id === fallbackPlanId) return;
    setFallbackPlanId(search.plan_id);
    window.sessionStorage.setItem("onboarding:selected-plan-id", search.plan_id);
  }, [fallbackPlanId, search.plan_id]);

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans").select("*").order("price_per_month", { ascending: true });
      if (error) throw error;
      return data as Plan[];
    },
  });

  // Active subscription (used in post-checkout steps)
  const { data: activeSub, refetch: refetchActiveSub } = useQuery({
    queryKey: ["onboarding-active-sub", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, plan:plans(*)")
        .eq("user_id", user!.id)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const grouped = useMemo(() => {
    const g: Record<Plan["type"], Plan[]> = { mornings: [], semi_private: [], private: [], combo: [] };
    (plans ?? []).forEach((p) => g[p.type].push(p));
    return g;
  }, [plans]);

  const selectedPlan = plans?.find((p) => p.id === selectedPlanId) ?? null;
  const needsShipping = selectedPlan && selectedPlan.type !== "mornings";
  const activePlan = (activeSub?.plan as Plan | undefined) ?? null;
  const isLiveSessionPlan = activePlan && activePlan.type !== "mornings";

  // After checkout redirects back with session_id, sync immediately so we don't depend on webhook timing.
  const successHandled = useRef(false);
  useEffect(() => {
    if (step !== "success" && !search.session_id) return;
    if (successHandled.current) return;
    successHandled.current = true;

    async function finishCheckoutReturn() {
      try {
        if (search.session_id) {
          await syncCheckout({ data: { sessionId: search.session_id } });
          await refetchActiveSub();
        }
        toast.success("Payment received. Let's finish setting up your account.");
        navigate({ to: "/onboarding", search: { step: "welcome" }, replace: true });
      } catch (err) {
        console.error(err);
        toast.error("Payment is still syncing. You can continue your intake and waiver now.");
        navigate({
          to: "/onboarding",
          search: selectedPlanId ? { step: "intake", plan_id: selectedPlanId } : { step: "intake" },
          replace: true,
        });
      }
    }

    finishCheckoutReturn();
  }, [step, search.session_id, navigate, syncCheckout, refetchActiveSub, selectedPlanId]);

  function goTo(next: Step) {
    navigate({
      to: "/onboarding",
      search: selectedPlanId ? { step: next, plan_id: selectedPlanId } : { step: next },
      replace: true,
    });
  }

  function selectPlan(planId: string) {
    setFallbackPlanId(planId);
    window.sessionStorage.setItem("onboarding:selected-plan-id", planId);
    navigate({ to: "/onboarding", search: { step: "plan", plan_id: planId }, replace: true });
  }


  async function handleProceedFromPlan() {
    if (!selectedPlanId) return toast.error("Please choose a plan");
    goTo(needsShipping ? "shipping" : "commitment");
  }

  async function handleProceedFromShipping() {
    if (!address.line1 || !address.city || !address.country || !address.postal) {
      return toast.error("Please complete the shipping address");
    }
    goTo("commitment");
  }

  async function handleStartCheckout() {
    if (!acknowledged) return toast.error("Please acknowledge the 3-month commitment");
    if (!selectedPlanId || !user) return;
    setSubmitting(true);
    try {
      if (needsShipping) {
        const full = [address.line1, address.line2, `${address.city}, ${address.region} ${address.postal}`, address.country]
          .filter(Boolean).join("\n");
        const { error: efErr } = await supabase.from("equipment_fulfillment").upsert({
          user_id: user.id,
          shipping_address: full,
          status: "pending",
        }, { onConflict: "user_id" });
        if (efErr) throw efErr;
      }

      const data = await startCheckout({ data: { planId: selectedPlanId, returnUrl: window.location.origin } });
      if (!data?.url) throw new Error("No checkout URL returned");
      // Use top-level navigation so it works inside the Lovable preview iframe.
      try {
        if (window.top && window.top !== window.self) {
          window.top.location.href = data.url;
        } else {
          window.location.href = data.url;
        }
      } catch {
        // Cross-origin frame — fall back to opening in a new tab.
        window.open(data.url, "_blank", "noopener,noreferrer");
        setSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message || "Couldn't start checkout");
      setSubmitting(false);
    }
  }


  return (
    <div className="max-w-3xl mx-auto">
      <Stepper step={step} />


      {step === "plan" && (
        <div className="space-y-8">
          <header>
            <h1 className="font-display text-4xl text-foreground">Choose your plan</h1>
            <p className="mt-2 text-muted-foreground">Every plan includes complimentary access to 10 Minute Mornings.</p>
          </header>
          {(["mornings", "semi_private", "private", "combo"] as const).map((tier) => (
            <section key={tier}>
              <h2 className="font-display text-2xl text-foreground">{tierMeta[tier].label}</h2>
              <p className="text-sm text-muted-foreground mb-3">{tierMeta[tier].description}</p>
              <div className="grid md:grid-cols-2 gap-3">
                {grouped[tier].map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => selectPlan(plan.id)}
                    className={cn(
                      "text-left rounded-xl border p-4 transition-all bg-card",
                      selectedPlanId === plan.id
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{plan.display_name}</div>
                        {plan.sessions_per_week !== null && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {plan.sessions_per_week} session{plan.sessions_per_week > 1 ? "s" : ""} / week
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-display text-2xl text-foreground">${plan.price_per_month}</div>
                        <div className="text-xs text-muted-foreground">/ month</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
                      <Check size={12} className="text-primary" />
                      Includes 10 Minute Mornings
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
          <div className="flex justify-end">
            <button
              onClick={handleProceedFromPlan}
              disabled={!selectedPlanId}
              className="rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === "shipping" && (
        <div className="space-y-6">
          <header>
            <h1 className="font-display text-4xl text-foreground">Shipping address</h1>
            <p className="mt-2 text-muted-foreground">Where should we ship your equipment kit?</p>
          </header>
          <div className="grid gap-4 bg-card border border-border rounded-xl p-6">
            <Field label="Address line 1" value={address.line1} onChange={(v) => setAddress({ ...address, line1: v })} required />
            <Field label="Address line 2" value={address.line2} onChange={(v) => setAddress({ ...address, line2: v })} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="City" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} required />
              <Field label="State / Region" value={address.region} onChange={(v) => setAddress({ ...address, region: v })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Postal code" value={address.postal} onChange={(v) => setAddress({ ...address, postal: v })} required />
              <Field label="Country" value={address.country} onChange={(v) => setAddress({ ...address, country: v })} required />
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => goTo("plan")} className="text-sm text-muted-foreground hover:text-foreground">Back</button>
            <button
              onClick={handleProceedFromShipping}
              className="rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90"
            >Continue</button>
          </div>
        </div>
      )}

      {step === "commitment" && selectedPlan && (
        <div className="space-y-6">
          <header>
            <h1 className="font-display text-4xl text-foreground">3-month commitment</h1>
            <p className="mt-2 text-muted-foreground">Please review and acknowledge before checkout.</p>
          </header>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-baseline">
              <div>
                <div className="font-medium text-foreground">{selectedPlan.display_name}</div>
                <div className="text-xs text-muted-foreground">Billed monthly</div>
              </div>
              <div className="font-display text-2xl">${selectedPlan.price_per_month}<span className="text-sm text-muted-foreground">/mo</span></div>
            </div>
            <div className="text-sm text-foreground bg-muted/50 rounded-md p-4 leading-relaxed">
              All plans require a <strong>3-month minimum commitment</strong>. Your subscription will renew monthly, and you cannot cancel from within the app before the 3-month commitment period ends. After that, you can cancel anytime and your access will continue until the end of your current billing period.
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input"
              />
              <span className="text-sm text-foreground">I acknowledge and agree to the 3-month minimum commitment.</span>
            </label>
          </div>
          <div className="flex justify-between">
            <button onClick={() => goTo(needsShipping ? "shipping" : "plan")} className="text-sm text-muted-foreground hover:text-foreground">Back</button>
            <button
              onClick={handleStartCheckout}
              disabled={!acknowledged || submitting}
              className="rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Proceed to checkout
            </button>
          </div>
        </div>
      )}

      {step === "welcome" && (
        <WelcomeStep
          plan={activePlan}
          onContinue={() => goTo("intake")}
        />
      )}

      {step === "intake" && (
        <IntakeStep
          onDone={() => goTo("waiver")}
        />
      )}

      {step === "waiver" && (
        <WaiverStep
          onSigned={async () => {
            if (!user) return;
            // Mark onboarding complete + flag for slot assignment when on a live plan.
            const { error } = await supabase
              .from("users")
              .update({
                onboarding_complete: true,
                needs_slot_assignment: !!isLiveSessionPlan,
              })
              .eq("id", user.id);
            if (error) {
              toast.error(error.message);
              return;
            }
            // Welcome notification (in-app + email)
            try {
              const { notify } = await import("@/lib/notify");
              await notify({
                userId: user.id,
                type: "onboarding_complete",
                title: "Look at you!",
                message: isLiveSessionPlan
                  ? "You're officially part of the crew. I'll be reaching out soon to set you up in your recurring slot."
                  : "You're officially part of the crew. Poke around the app and get comfortable — I got you!",
                link: "/home",
                email: user.email
                  ? {
                      to: user.email,
                      templateName: "onboarding-complete",
                      idempotencyKey: `onboarding-complete-${user.id}`,
                      templateData: { name: user.user_metadata?.name, isLiveSession: isLiveSessionPlan },
                    }
                  : undefined,
              });
            } catch (e) {
              console.error("onboarding notify failed", e);
            }
            qc.invalidateQueries({ queryKey: ["onboarding-gate"] });
            goTo("done");
          }}
        />
      )}

      {step === "done" && (
        <DoneStep
          plan={activePlan}
          onExplore={() => navigate({ to: "/home" })}
        />
      )}
    </div>
  );
}

function WelcomeStep({ plan, onContinue }: { plan: Plan | null; onContinue: () => void }) {
  const showsEquipment = plan && plan.type !== "mornings";
  return (
    <div className="space-y-8">
      <header className="text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
          <Sparkles size={22} />
        </div>
        <h1 className="font-display text-4xl text-foreground">Welcome to Pilates with Jon</h1>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          We're so glad you're here. A couple of quick steps and you'll be ready to start moving with us.
        </p>
      </header>

      {showsEquipment && (
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-md bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
              <PackageCheck size={20} />
            </div>
            <div>
              <h2 className="font-display text-xl text-foreground">Your equipment is on the way</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your starter kit will ship to the address you provided. It includes:
              </p>
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-6 text-sm text-foreground">
                {["Foam roller", "Pilates ring", "Resistance bands", "Stretch strap", "Two door anchors"].map((item) => (
                  <li key={item} className="flex items-center gap-2"><Check size={14} className="text-primary" />{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-xl text-foreground">Next: your intake form</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us a little about your goals and history so we can tailor your experience. Takes about 2 minutes.
        </p>
      </section>

      <div className="flex justify-end">
        <button
          onClick={onContinue}
          className="rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90"
        >Start intake form</button>
      </div>
    </div>
  );
}

const FITNESS_LEVELS = [
  { id: "beginner", label: "Beginner" },
  { id: "some", label: "Some experience" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
] as const;

const PRIMARY_GOALS = [
  { id: "stronger", label: "Get stronger" },
  { id: "flexibility", label: "Improve flexibility" },
  { id: "recover", label: "Recover from injury" },
  { id: "wellness", label: "General wellness" },
  { id: "other", label: "Other" },
] as const;

function IntakeStep({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [fitness, setFitness] = useState<string[]>([]);
  const [goal, setGoal] = useState<string[]>([]);
  const [injuries, setInjuries] = useState("");
  const [days, setDays] = useState<number>(3);
  const [referral, setReferral] = useState("");
  const [saving, setSaving] = useState(false);

  function toggle(list: string[], id: string, setter: (v: string[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function submit() {
    if (!user) return;
    if (fitness.length === 0 || goal.length === 0 || !injuries.trim()) {
      return toast.error("Please answer the required questions");
    }
    setSaving(true);
    try {
      const fitnessStr = fitness.join(", ");
      const goalStr = goal.join(", ");
      const { error } = await supabase.from("intake_forms").insert({
        user_id: user.id,
        fitness_level: fitnessStr,
        primary_goal: goalStr,
        injuries: injuries,
        days_per_week: days,
        referral_source: referral || null,
        // legacy mirror fields
        goals: goalStr,
        health_history: injuries,
      });
      if (error) throw error;
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-foreground">Tell us about you</h1>
        <p className="mt-2 text-muted-foreground">A few quick questions so we can shape your program.</p>
      </header>

      <section className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div>
          <label className="text-sm font-medium text-foreground">Current fitness level * <span className="text-muted-foreground font-normal">(select all that apply)</span></label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {FITNESS_LEVELS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(fitness, f.id, setFitness)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm text-left transition-colors",
                  fitness.includes(f.id) ? "border-primary bg-primary/5 text-foreground" : "border-border hover:border-primary/50 text-foreground",
                )}
              >{f.label}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Primary goal * <span className="text-muted-foreground font-normal">(select all that apply)</span></label>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRIMARY_GOALS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => toggle(goal, g.id, setGoal)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm text-left transition-colors",
                  goal.includes(g.id) ? "border-primary bg-primary/5 text-foreground" : "border-border hover:border-primary/50 text-foreground",
                )}
              >{g.label}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Any injuries or physical limitations? *</label>
          <textarea
            value={injuries}
            onChange={(e) => setInjuries(e.target.value)}
            rows={3}
            required
            placeholder="Anything we should know about — recent surgeries, chronic pain, things to avoid. Write 'none' if not applicable."
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Days per week you plan to work out</label>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range" min={1} max={7} value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="flex-1 accent-primary"
            />
            <div className="font-display text-2xl text-foreground w-10 text-right">{days}</div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">How did you hear about us?</label>
          <input
            value={referral}
            onChange={(e) => setReferral(e.target.value)}
            placeholder="Optional"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={saving}
          className="rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          Continue
        </button>
      </div>
    </div>
  );
}

function WaiverStep({ onSigned }: { onSigned: () => void }) {
  const { user } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!user) return;
    if (!confirmed) return toast.error("Please confirm you've submitted the waiver form");
    setSubmitting(true);
    try {
      let ip: string | null = null;
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const j = await res.json();
        ip = j.ip ?? null;
      } catch { /* ignore */ }

      const { error } = await supabase.from("waivers").insert({
        user_id: user.id,
        content_snapshot: "Signed via Google Form: https://docs.google.com/forms/d/e/1FAIpQLSehzGlygRHXHP3aan7baRPN2bwrRtHDHvNb5Oq56uBKqUOh7w/viewform",
        ip_address: ip,
      });
      if (error) throw error;
      await onSigned();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-foreground">Liability waiver</h1>
        <p className="mt-2 text-muted-foreground">Please complete and submit the waiver form below.</p>
      </header>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <iframe
          src="https://docs.google.com/forms/d/e/1FAIpQLSehzGlygRHXHP3aan7baRPN2bwrRtHDHvNb5Oq56uBKqUOh7w/viewform?embedded=true"
          className="w-full block"
          style={{ height: "2617px", border: 0 }}
          title="Liability waiver"
        >
          Loading…
        </iframe>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input"
          />
          <span className="text-sm text-foreground">I have completed and submitted the waiver form above.</span>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={submitting || !confirmed}
          className="rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Continue
        </button>
      </div>
    </div>
  );
}

function DoneStep({ plan, onExplore }: { plan: Plan | null; onExplore: () => void }) {
  const isLive = plan && plan.type !== "mornings";
  return (
    <div className="text-center py-10 space-y-6">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary">
        <Check size={28} />
      </div>
      <div>
        <h1 className="font-display text-4xl text-foreground">You're all set</h1>
        <p className="mt-2 text-muted-foreground">Welcome to the studio.</p>
      </div>

      {plan && (
        <section className="rounded-xl border border-border bg-card p-6 text-left max-w-xl mx-auto">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Your plan</div>
              <div className="font-display text-2xl text-foreground mt-1">{plan.display_name}</div>
            </div>
            <div className="font-display text-xl text-foreground">${plan.price_per_month}<span className="text-sm text-muted-foreground">/mo</span></div>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm text-foreground">
            <li className="flex items-center gap-2"><Check size={14} className="text-primary" />Includes 10 Minute Mornings video library</li>
            {isLive && (
              <>
                <li className="flex items-center gap-2"><Check size={14} className="text-primary" />Equipment kit shipped to your address</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-primary" />Live {plan.type === "private" ? "private" : plan.type === "semi_private" ? "semi-private" : "private + semi-private"} sessions</li>
              </>
            )}
          </ul>
          {isLive && (
            <p className="mt-4 text-sm rounded-md bg-muted/50 p-3 text-foreground">
              Your recurring session slot will be assigned by our team shortly. You'll get a notification as soon as it's set.
            </p>
          )}
        </section>
      )}

      <button
        onClick={onExplore}
        className="rounded-md bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90"
      >Explore the app</button>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const isPostCheckout = step === "welcome" || step === "intake" || step === "waiver" || step === "done";
  const steps = isPostCheckout
    ? ([
        { id: "welcome", label: "Welcome" },
        { id: "intake", label: "Intake" },
        { id: "waiver", label: "Waiver" },
        { id: "done", label: "Done" },
      ] as const)
    : ([
        { id: "plan", label: "Plan" },
        { id: "shipping", label: "Shipping" },
        { id: "commitment", label: "Commitment" },
        { id: "checkout", label: "Checkout" },
      ] as const);
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center gap-2 mb-10">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2 flex-1">
          <div className={cn(
            "h-1.5 rounded-full flex-1",
            i <= idx ? "bg-primary" : "bg-muted",
          )} />
        </div>
      ))}
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground">{label}{required && " *"}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
