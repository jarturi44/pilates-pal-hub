import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding_/setup")({
  component: OnboardingSetupPage,
});

const WAIVER_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSehzGlygRHXHP3aan7baRPN2bwrRtHDHvNb5Oq56uBKqUOh7w/viewform";
const AVAILABILITY_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScSSWRDsJGOzX7k3EQbSt9-T8GRIsw4BV7OnWNJYIaY9nkTrw/viewform";

function OnboardingSetupPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const userId = user?.id;

  const { data: profile } = useQuery({
    enabled: !!userId,
    queryKey: ["setup-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("users").select("name").eq("id", userId!).maybeSingle();
      return data;
    },
  });

  const { data: sub } = useQuery({
    enabled: !!userId,
    queryKey: ["setup-sub", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status, plan:plans(display_name, type)")
        .eq("user_id", userId!)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: progress } = useQuery({
    enabled: !!userId,
    queryKey: ["onboarding-progress", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("onboarding_progress")
        .select("waiver_completed_at, availability_completed_at")
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  const [waiverChecked, setWaiverChecked] = useState(false);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    if (!progress) return;
    if (progress.waiver_completed_at) setWaiverChecked(true);
    if (progress.availability_completed_at) setAvailabilityChecked(true);
  }, [progress]);

  const firstName = useMemo(() => {
    const n = profile?.name?.trim() || user?.email?.split("@")[0] || "there";
    return n.split(" ")[0];
  }, [profile?.name, user?.email]);

  const planName = (sub?.plan as { display_name: string | null; type: string | null } | null)?.display_name ?? "";
  const showAvailability = !/10\s*Minute\s*Mornings\s*only/i.test(planName);

  async function upsertProgress(patch: { waiver_completed_at?: string | null; availability_completed_at?: string | null }) {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("onboarding_progress")
      .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    qc.invalidateQueries({ queryKey: ["onboarding-progress", userId] });
    return true;
  }

  async function onToggleWaiver(checked: boolean) {
    setWaiverChecked(checked);
    const ok = await upsertProgress({ waiver_completed_at: checked ? new Date().toISOString() : null });
    if (!ok) setWaiverChecked(!checked);
  }

  async function onToggleAvailability(checked: boolean) {
    setAvailabilityChecked(checked);
    const ok = await upsertProgress({ availability_completed_at: checked ? new Date().toISOString() : null });
    if (!ok) setAvailabilityChecked(!checked);
  }

  const canContinue = waiverChecked && (!showAvailability || availabilityChecked);

  async function handleContinue() {
    if (!canContinue || !userId) return;
    setContinuing(true);
    const planType = (sub?.plan as { type: string | null } | null)?.type ?? null;
    const { error } = await supabase
      .from("users")
      .update({
        onboarding_complete: true,
        needs_slot_assignment: planType !== null && planType !== "mornings",
      })
      .eq("id", userId);
    if (error) {
      setContinuing(false);
      toast.error(error.message);
      return;
    }
    navigate({ to: "/home" });
  }

  return (
    <div className="max-w-2xl mx-auto">
      <header className="text-center mb-10">
        <h1 className="font-display text-3xl md:text-4xl text-foreground">
          Welcome to Pilates with Jon, {firstName}!
        </h1>
        <p className="mt-3 text-muted-foreground">Two quick steps before you start.</p>
      </header>

      <div className="space-y-6">
        <StepCard
          number={1}
          title="Sign your liability waiver"
          description="Please read and sign the waiver below. Form Publisher will email you a PDF copy when you're done."
          actionLabel="Open the waiver"
          actionHref={WAIVER_URL}
          checkboxLabel="I've completed the waiver."
          checked={waiverChecked}
          onChange={onToggleWaiver}
          saving={saving}
        />

        {showAvailability && (
          <StepCard
            number={2}
            title="Set your availability"
            description="Tell us what days and times work for you so we can match you to a class slot."
            actionLabel="Set my availability"
            actionHref={AVAILABILITY_URL}
            checkboxLabel="I've completed the availability form."
            checked={availabilityChecked}
            onChange={onToggleAvailability}
            saving={saving}
          />
        )}
      </div>

      <div className="mt-10 flex justify-center">
        <button
          onClick={handleContinue}
          disabled={!canContinue || continuing}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-6 py-3 text-base font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {continuing && <Loader2 size={16} className="animate-spin" />}
          Continue to my Program
        </button>
      </div>
    </div>
  );
}

function StepCard({
  number, title, description, actionLabel, actionHref,
  checkboxLabel, checked, onChange, saving,
}: {
  number: number;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  checkboxLabel: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  saving: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border bg-card p-6 md:p-8 transition-colors",
      checked ? "border-primary/40" : "border-border",
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          "shrink-0 h-9 w-9 rounded-full flex items-center justify-center font-display text-lg",
          checked ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}>
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>

          <a
            href={actionHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-background hover:bg-accent hover:text-accent-foreground px-4 py-2 text-sm font-medium"
          >
            {actionLabel}
            <ExternalLink size={14} />
          </a>

          <label className="mt-5 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              disabled={saving}
              onChange={(e) => onChange(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-input"
            />
            <span className="text-sm text-foreground">{checkboxLabel}</span>
          </label>
        </div>
      </div>
    </div>
  );
}
