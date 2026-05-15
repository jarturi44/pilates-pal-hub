import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PagePrimitives";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, Package } from "lucide-react";
import { sendTransactionalEmail } from "@/lib/email/send";

export const Route = createFileRoute("/_authenticated/fulfillment")({
  component: FulfillmentPage,
});

type Row = {
  id: string;
  created_at: string;
  shipping_address: string | null;
  status: "pending" | "shipped";
  user_id: string;
  user_name: string | null;
  user_email: string;
  plan_name: string | null;
};

function FulfillmentPage() {
  const qc = useQueryClient();
  const [working, setWorking] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["fulfillment-pending"],
    queryFn: async (): Promise<Row[]> => {
      const { data: ef, error } = await supabase
        .from("equipment_fulfillment")
        .select("id, created_at, shipping_address, status, user_id")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!ef?.length) return [];

      const userIds = ef.map((r) => r.user_id);
      const [{ data: users }, { data: subs }] = await Promise.all([
        supabase.from("users").select("id, name, email").in("id", userIds),
        supabase.from("subscriptions")
          .select("user_id, plan:plans(display_name)")
          .in("user_id", userIds)
          .order("created_at", { ascending: false }),
      ]);
      const userMap = new Map(users?.map((u) => [u.id, u]) ?? []);
      const planMap = new Map<string, string | null>();
      (subs ?? []).forEach((s: any) => { if (!planMap.has(s.user_id)) planMap.set(s.user_id, s.plan?.display_name ?? null); });

      return ef.map((r) => ({
        ...r,
        status: r.status as "pending" | "shipped",
        user_name: userMap.get(r.user_id)?.name ?? null,
        user_email: userMap.get(r.user_id)?.email ?? "",
        plan_name: planMap.get(r.user_id) ?? null,
      }));
    },
  });

  async function markShipped(row: Row) {
    setWorking(row.id);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("equipment_fulfillment")
      .update({ status: "shipped", shipped_at: now })
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      setWorking(null);
      return;
    }
    // In-app notification (email integration to be added once email domain is set up)
    await supabase.from("notifications").insert({
      user_id: row.user_id,
      type: "fulfillment",
      message: "Your equipment is on the way! We've shipped your kit and you'll receive it soon.",
    });
    toast.success("Marked as shipped");
    qc.invalidateQueries({ queryKey: ["fulfillment-pending"] });
    setWorking(null);
  }

  return (
    <>
      <PageHeader title="Fulfillment" subtitle="Pending equipment shipments for new subscribers." />
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : !data?.length ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Package className="mx-auto text-muted-foreground mb-2" size={28} />
          <p className="text-sm text-muted-foreground">No pending shipments. 🎉</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Shipping address</th>
                <th className="px-4 py-3">Signed up</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{row.user_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{row.user_email}</div>
                  </td>
                  <td className="px-4 py-3 text-foreground">{row.plan_name ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-pre-line text-muted-foreground max-w-xs">{row.shipping_address ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => markShipped(row)}
                      disabled={working === row.id}
                      className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {working === row.id ? <Loader2 size={12} className="animate-spin" /> : null}
                      Mark shipped
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
