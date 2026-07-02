import { useState, useEffect, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home, Calendar, LineChart, Bell, User as UserIcon,
  LayoutDashboard, Users, Clock, Film, Settings, Menu, X, LogOut, Package, ClipboardCheck, Megaphone, UserPlus, Globe,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/Wordmark";

const clientNav = [
  { to: "/portal", label: "Portal", icon: Home },
  { to: "/progress", label: "Progress", icon: LineChart },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: UserIcon },
] as const;

const adminNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/migrate", label: "Migrate", icon: UserPlus },
  { to: "/slots", label: "Slots", icon: Clock },
  { to: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/content", label: "Content", icon: Film },
  { to: "/fulfillment", label: "Fulfillment", icon: Package },
  { to: "/broadcasts", label: "Messages", icon: Megaphone },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { role, user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const items = role === "admin" ? adminNav : clientNav;

  // Shop URL for client nav (paused — Printful has a $24/mo store fee)

  // Unread count for the Notifications nav item.
  const { data: unread = 0 } = useQuery({
    queryKey: ["notif-unread", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      return count ?? 0;
    },
    refetchInterval: 60000,
  });

  // Realtime: keep badge in sync.
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase.channel(`notif-badge-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notif-unread", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc]);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile top bar */}
      <header className="md:hidden fixed inset-x-0 top-0 z-40 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4">
        <Link to="/" className="text-sidebar-foreground"><Wordmark size="md" /></Link>
        <button
          onClick={() => setOpen((v) => !v)}
          className="p-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"
          aria-label="Toggle navigation"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:sticky md:top-0 z-30 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          "pt-14 md:pt-0",
        )}
      >
        <div className="hidden md:flex items-center px-6 h-16 border-b border-sidebar-border">
          <Wordmark size="md" className="text-sidebar-foreground" />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon size={18} />
                <span className="flex-1">{item.label}</span>
                {item.to === "/notifications" && unread > 0 && (
                  <span className="rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 min-w-[18px] text-center">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user?.email}</div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="max-w-5xl mx-auto p-6 md:p-10">{children}</div>
      </main>
    </div>
  );
}
