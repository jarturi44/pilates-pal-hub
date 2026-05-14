import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Search = { step?: "plan" | "shipping" | "commitment" | "checkout" | "success"; session_id?: string };

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    step: (s.step as Search["step"]) ?? "plan",
    session_id: s.session_id as string | undefined,
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
  semi_private: { label: "Semi-Private", description: "Small group, live sessions. Includes the Mornings library." },
  private: { label: "Private", description: "One-on-one live sessions. Includes the Mornings library." },
  combo: { label: "Combo", description: "Mix of private and semi-private. Includes the Mornings library." },
};

function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/onboarding" });
  const step = search.step ?? "plan";

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [address, setAddress] = useState({ line1: "", line2: "", city: "", region: "", postal: "", country: "" });
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans").select("*").order("price_per_month", { ascending: true });
      if (error) throw error;
      return data as Plan[];
    },
  });

  const grouped = useMemo(() => {
    const g: Record<Plan["type"], Plan[]> = { mornings: [], semi_private: [], private: [], combo: [] };
    (plans ?? []).forEach((p) => g[p.type].push(p));
    return g;
  }, [plans]);

  const selectedPlan = plans?.find((p) => p.id === selectedPlanId) ?? null;
  const needsShipping = selectedPlan && selectedPlan.type !== "mornings";

  // After Stripe redirects back with session_id, finalize.
  useEffect(() => {
    if (step !== "success" || !user) return;
    // Webhook does the heavy lifting. Just route the user forward.
    toast.success("Payment received. Let's finish setting up your account.");
    const t = setTimeout(() => navigate({ to: "/home" }), 1200);
    return () => clearTimeout(t);
  }, [step, user, navigate]);

  function goTo(next: Search["step"]) {
    navigate({ to: "/_authenticated/onboarding", search: { step: next }, replace: true });
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
      // Save shipping address up-front (status pending). Upsert avoids dupes.
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

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan_id: selectedPlanId, return_url: window.location.origin },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL returned");
      window.location.href = data.url;
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
                    onClick={() => setSelectedPlanId(plan.id)}
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

      {step === "success" && (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-4">
            <Check size={24} />
          </div>
          <h1 className="font-display text-3xl text-foreground">You're all set</h1>
          <p className="mt-2 text-muted-foreground">Redirecting you to your home…</p>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Search["step"] }) {
  const steps: { id: Search["step"]; label: string }[] = [
    { id: "plan", label: "Plan" },
    { id: "shipping", label: "Shipping" },
    { id: "commitment", label: "Commitment" },
    { id: "checkout", label: "Checkout" },
  ];
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
