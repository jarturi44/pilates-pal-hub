import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding_/setup")({
  component: OnboardingSetupPage,
});

const WAIVER_FORM_BASE =
  "https://docs.google.com/forms/d/e/1FAIpQLSehzGlygRHXHP3aan7baRPN2bwrRtHDHvNb5Oq56uBKqUOh7w/viewform?embedded=true";
const AVAILABILITY_FORM_BASE =
  "https://docs.google.com/forms/d/e/1FAIpQLScSSWRDsJGOzX7k3EQbSt9-T8GRIsw4BV7OnWNJYIaY9nkTrw/viewform?embedded=true";

const MORNINGS_ONLY_PLAN_NAME = "10 Minute Mornings only";

type SetupData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  planName: string;
  planType: string | null;
  waiverCompletedAt: string | null;
  availabilityCompletedAt: string | null;
};

/**
 * Parses the multi-line shipping_address string stored by the shipping step.
 * Format:
 *   "{First} {Last}\nPhone: {phone}\n{line1}\n{line2?}\n{city}, {region} {postal}\n{country}"
 */
function parseShipping(raw: string | null) {
  if (!raw) return { firstName: "", lastName: "", phone: "", address: "" };
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  let firstName = "";
  let lastName = "";
  let phone = "";
  const addressLines: string[] = [];
  for (const line of lines) {
    if (!firstName && !line.toLowerCase().startsWith("phone:") && !/\d/.test(line)) {
      const parts = line.split(/\s+/);
      firstName = parts[0] ?? "";
      lastName = parts.slice(1).join(" ");
      continue;
    }
    if (line.toLowerCase().startsWith("phone:")) {
      phone = line.slice(6).trim();
      continue;
    }
    addressLines.push(line);
  }
  return { firstName, lastName, phone, address: addressLines.join(", ") };
}

function OnboardingSetupPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [continuing, setContinuing] = useState(false);

  // Local optimistic state for checkboxes
  const [waiverChecked, setWaiverChecked] = useState(false);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-setup", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<SetupData> => {
      const [userRes, shipRes, subRes, progRes] = await Promise.all([
        supabase.from("users").select("name, email").eq("id", user!.id).maybeSingle(),
        supabase.from("equipment_fulfillment").select("shipping_address").eq("user_id", user!.id).maybeSingle(),
        supabase
          .from("subscriptions")
          .select("plan:plans(display_name, type)")
          .eq("user_id", user!.id)
          .in("status", ["active", "trialing", "past_due"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("onboarding_progress")
          .select("waiver_completed_at, availability_completed_at")
          .eq("user_id", user!.id)
          .maybeSingle(),
      ]);

      const parsed = parseShipping(shipRes.data?.shipping_address ?? null);
      // Fallback to users.name split if shipping didn't capture names
      if (!parsed.firstName && userRes.data?.name) {
        const parts = userRes.data.name.split(/\s+/);
        parsed.firstName = parts[0] ?? "";
        parsed.lastName = parts.slice(1).join(" ");
      }
      const plan = (subRes.data?.plan as any) ?? null;
      return {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email: userRes.data?.email ?? user!.email ?? "",
        phone: parsed.phone,
        address: parsed.address,
        planName: plan?.display_name ?? "",
        planType: plan?.type ?? null,
        waiverCompletedAt: progRes.data?.waiver_completed_at ?? null,
        availabilityCompletedAt: progRes.data?.availability_completed_at ?? null,
      };
    },
  });

  // Hydrate local checkbox state from DB
  useEffect(() => {
    if (!data) return;
    setWaiverChecked(!!data.waiverCompletedAt);
    setAvailabilityChecked(!!data.availabilityCompletedAt);
  }, [data]);

  // Step 2 is hidden for mornings-only plans
  const showAvailability = useMemo(() => {
    if (!data) return false;
    if (data.planType === "mornings") return false;
    if (data.planName.trim().toLowerCase() === MORNINGS_ONLY_PLAN_NAME.toLowerCase()) return false;
    return true;
  }, [data]);

  const waiverUrl = useMemo(() => {
    if (!data) return WAIVER_FORM_BASE;
    const p = new URLSearchParams({
      usp: "pp_url",
      "entry.2111295948": data.firstName,
      "entry.1659344374": data.lastName,
      "entry.813858213": data.email,
      "entry.289220116": data.phone,
      "entry.130104280": data.address,
    });
    return `${WAIVER_FORM_BASE}&${p.toString()}`;
  }, [data]);

  const availabilityUrl = useMemo(() => {
    if (!data) return AVAILABILITY_FORM_BASE;
    const p = new URLSearchParams({
      usp: "pp_url",
      "entry.1975683142": data.firstName,
      "entry.428619510": data.lastName,
      "entry.370732051": data.email,
      "entry.817882999": data.planName,
    });
    return `${AVAILABILITY_FORM_BASE}&${p.toString()}`;
  }, [data]);

  async function toggleWaiver(checked: boolean) {
    if (!user) return;
    setWaiverChecked(checked);
    setSaving(true);
    const { error } = await supabase.from("onboarding_progress").upsert(
      {
        user_id: user.id,
        waiver_completed_at: checked ? new Date().toISOString() : null,
      },
      { onConflict: "user_id" },
    );
    setSaving(false);
    if (error) {
      setWaiverChecked(!checked);
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["onboarding-setup", user.id] });
  }

  async function toggleAvailability(checked: boolean) {
    if (!user) return;
    setAvailabilityChecked(checked);
    setSaving(true);
    const { error } = await supabase.from("onboarding_progress").upsert(
      {
        user_id: user.id,
        availability_completed_at: checked ? new Date().toISOString() : null,
      },
      { onConflict: "user_id" },
    );
    setSaving(false);
    if (error) {
      setAvailabilityChecked(!checked);
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["onboarding-setup", user.id] });
  }

  const requiredMet = waiverChecked && (!showAvailability || availabilityChecked);

  async function handleContinue() {
    if (!user || !requiredMet) return;
    setContinuing(true);
    const { error } = await supabase
      .from("users")
      .update({
        onboarding_complete: true,
        needs_slot_assignment: showAvailability,
      })
      .eq("id", user.id);
    if (error) {
      toast.error(error.message);
      setContinuing(false);
      return;
    }
    qc.invalidateQueries({ queryKey: ["onboarding-gate"] });
    navigate({ to: "/home" });
  }

  if (isLoading || !data) {
    return (
      <div className="flex justify-center items-center gap-2 text-sm text-muted-foreground py-20">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header className="text-center">
        <h1 className="font-display text-3xl sm:text-4xl text-foreground">
          Welcome to Pilates with Jon{data.firstName ? `, ${data.firstName}` : ""}!
        </h1>
        <p className="mt-2 text-muted-foreground">Two quick steps before you start.</p>
      </header>

      <StepCard
        n={1}
        title="Sign your liability waiver"
        body="We've pre-filled your info to save you time. Review and sign below — Form Publisher will email you a PDF copy when you're done. Then check the box."
        iframeTitle="Liability Waiver"
        src={waiverUrl}
        checked={waiverChecked}
        onCheckedChange={toggleWaiver}
        checkboxLabel="I've completed the waiver."
        saving={saving}
      />

      {showAvailability && (
        <StepCard
          n={2}
          title="Set your availability"
          body="Tell us what days and times work for you so we can match you to the right class slot. Then check the box."
          iframeTitle="Availability Form"
          src={availabilityUrl}
          checked={availabilityChecked}
          onCheckedChange={toggleAvailability}
          checkboxLabel="I've completed the availability form."
          saving={saving}
        />
      )}

      <div className="flex justify-center pt-2">
        <button
          onClick={handleContinue}
          disabled={!requiredMet || continuing}
          className={cn(
            "w-full sm:w-auto rounded-md bg-primary text-primary-foreground px-8 py-3 text-base font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2",
          )}
        >
          {continuing && <Loader2 size={16} className="animate-spin" />}
          Continue to my Program
        </button>
      </div>
    </div>
  );
}

function StepCard({
  n,
  title,
  body,
  buttonLabel,
  href,
  checked,
  onCheckedChange,
  checkboxLabel,
  saving,
}: {
  n: number;
  title: string;
  body: string;
  buttonLabel: string;
  href: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  checkboxLabel: string;
  saving: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "h-9 w-9 shrink-0 rounded-full inline-flex items-center justify-center font-display text-lg",
            checked ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
          )}
        >
          {checked ? <Check size={18} /> : n}
        </div>
        <div className="flex-1">
          <h2 className="font-display text-xl text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
      </div>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        {buttonLabel} <ExternalLink size={14} />
      </a>

      <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-border">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          disabled={saving}
          className="mt-1 h-4 w-4 rounded border-input"
        />
        <span className="text-sm text-foreground">{checkboxLabel}</span>
      </label>
    </section>
  );
}
