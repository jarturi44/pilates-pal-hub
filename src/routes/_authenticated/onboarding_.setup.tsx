import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { completeOnboarding } from "@/lib/user-admin.functions";
import { useAuth } from "@/lib/auth-context";
import { Check, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding_/setup")({
  component: OnboardingSetupPage,
});

const WAIVER_FORM_BASE =
  "https://docs.google.com/forms/d/e/1FAIpQLScjEUm-QpanbVqUNJJQYWnEHfW9MNzRYNxk6URTeAxT1fP0wg/viewform?embedded=true";

type SetupData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  waiverCompletedAt: string | null;
};

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
  const completeOnboardingFn = useServerFn(completeOnboarding);
  const [waiverChecked, setWaiverChecked] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-setup", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<SetupData> => {
      const [userRes, shipRes, progRes] = await Promise.all([
        supabase.from("users").select("name, email").eq("id", user!.id).maybeSingle(),
        supabase
          .from("equipment_fulfillment")
          .select("first_name, last_name, phone, street, city, state, zip, shipping_address")
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase
          .from("onboarding_progress")
          .select("waiver_completed_at")
          .eq("user_id", user!.id)
          .maybeSingle(),
      ]);

      const ef = shipRes.data;
      const nameParts = (userRes.data?.name ?? "").split(/\s+/);
      const firstName = ef?.first_name ?? nameParts[0] ?? "";
      const lastName = ef?.last_name ?? nameParts.slice(1).join(" ") ?? "";
      const address = ef?.street ?? (ef?.shipping_address ? ef.shipping_address.split("\n")[1] ?? "" : "");

      return {
        firstName,
        lastName,
        email: userRes.data?.email ?? user!.email ?? "",
        phone: ef?.phone ?? "",
        address,
        city: ef?.city ?? "",
        state: ef?.state ?? "",
        zip: ef?.zip ?? "",
        waiverCompletedAt: progRes.data?.waiver_completed_at ?? null,
      };
    },
  });

  useEffect(() => {
    if (!data) return;
    setWaiverChecked(!!data.waiverCompletedAt);
  }, [data]);

  const waiverUrl = useMemo(() => {
    if (!data) return WAIVER_FORM_BASE;
    const p = new URLSearchParams({
      usp: "pp_url",
      "entry.1918456924": data.firstName,
      "entry.1607294814": data.lastName,
      "entry.1430114323": data.phone,
      "entry.1873751175": data.address,
      "entry.1984171968": data.city,
      "entry.1584918641": data.state,
      "entry.777565140": data.zip,
      "entry.1098094088": data.email,
    });
    return `${WAIVER_FORM_BASE}&${p.toString()}`;
  }, [data]);

  const waiverCheckQuery = useQuery({
    queryKey: ["waiver-completion", data?.email],
    enabled: !!data?.email,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from("waiver_completions")
        .select("email")
        .ilike("email", data!.email)
        .maybeSingle();
      if (error) throw error;
      return !!row;
    },
  });
  const waiverSubmitted = !!waiverCheckQuery.data;




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

  async function handleContinue() {
    if (!user || !waiverChecked) return;
    setContinuing(true);
    try {
      await completeOnboardingFn();
    } catch (err) {
      toast.error((err as Error).message);
      setContinuing(false);
      return;
    }
    qc.invalidateQueries({ queryKey: ["onboarding-gate"] });
    navigate({ to: "/portal" });
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
        <p className="mt-2 text-muted-foreground">One last step before you start.</p>
      </header>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "h-9 w-9 shrink-0 rounded-full inline-flex items-center justify-center font-display text-lg",
              waiverChecked ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
            )}
          >
            {waiverChecked ? <Check size={18} /> : 1}
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl text-foreground">Sign your liability waiver</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We've pre-filled your info to save you time. Review and sign below — Form Publisher will email you a PDF copy when you're done. Then check the box.
            </p>
          </div>
        </div>

        <div className="rounded-lg overflow-hidden border border-border bg-background">
          <iframe
            src={waiverUrl}
            title="Liability Waiver"
            className="w-full block"
            style={{ height: "70vh", minHeight: 520 }}
            frameBorder={0}
            marginHeight={0}
            marginWidth={0}
          >
            Loading…
          </iframe>
        </div>

        <div className="pt-2 border-t border-border space-y-3">
          {waiverSubmitted && (
            <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-sm text-foreground flex items-center gap-2">
              <Check size={14} className="text-primary" />
              We received your waiver submission for <span className="font-medium">{data.email}</span>.
            </div>
          )}
          <div className="rounded-md bg-muted border border-border px-3 py-3 text-sm text-foreground space-y-2">
            <p>
              Complete and submit the waiver above (or{" "}
              <a href={waiverUrl} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
                open in a new tab <ExternalLink size={12} />
              </a>
              ), then check the box below to continue.
            </p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={waiverChecked}
              onChange={(e) => toggleWaiver(e.target.checked)}
              disabled={saving}
              className="mt-1 h-4 w-4 rounded border-input"
            />
            <span className="text-sm text-foreground">
              I've submitted the waiver above.
            </span>
          </label>
        </div>
      </section>


      <div className="flex justify-center pt-2">
        <button
          onClick={handleContinue}
          disabled={!waiverChecked || continuing}
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
