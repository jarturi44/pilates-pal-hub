import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PagePrimitives";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

type NotificationRow = {
  id: string;
  type: string;
  title: string | null;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 2) return "yesterday";
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, title, message, link, read, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  // Realtime: refresh on inserts/updates
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase.channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    qc.invalidateQueries({ queryKey: ["notif-unread", user?.id] });
  }

  async function markAllRead() {
    if (!user?.id) return;
    const { error } = await supabase.from("notifications").update({ read: true })
      .eq("user_id", user.id).eq("read", false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
    qc.invalidateQueries({ queryKey: ["notif-unread", user.id] });
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Updates from the studio."
        right={
          unreadCount > 0 ? (
            <button onClick={markAllRead} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted inline-flex items-center gap-1.5">
              <CheckCheck size={12} /> Mark all read
            </button>
          ) : null
        }
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Bell className="mx-auto text-muted-foreground mb-2" size={28} />
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const Wrapper: any = n.link ? Link : "div";
            const wrapperProps: any = n.link ? { to: n.link } : {};
            return (
              <li key={n.id}>
                <Wrapper
                  {...wrapperProps}
                  onClick={() => { if (!n.read) markRead(n.id); }}
                  className={cn(
                    "block rounded-xl border p-4 transition-colors cursor-pointer",
                    n.read
                      ? "border-border bg-card hover:bg-muted/40"
                      : "border-primary/40 bg-primary/5 hover:bg-primary/10",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        <div className="font-medium text-foreground truncate">{n.title || n.type}</div>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                  </div>
                </Wrapper>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
