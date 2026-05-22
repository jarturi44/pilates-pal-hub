import { createFileRoute, Link, useNavigate, useRouterState, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LoadingScreen, Wordmark } from "@/components/Wordmark";
import { useAuth } from "@/lib/auth-context";

function getSafeRedirect(redirect: string | undefined) {
  if (!redirect?.startsWith("/") || redirect.startsWith("//") || redirect.startsWith("/login")) return null;
  return redirect;
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: getSafeRedirect(typeof s.redirect === "string" ? s.redirect : undefined) ?? undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const rawSearch = useRouterState({ select: (s) => s.location.searchStr });
  const { loading: authLoading, session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const safeRedirect = getSafeRedirect(search.redirect);

  useEffect(() => {
    if (!authLoading && !session && !safeRedirect && rawSearch) {
      navigate({ to: "/login", replace: true });
    }
  }, [authLoading, navigate, rawSearch, safeRedirect, session]);

  useEffect(() => {
    if (authLoading || !session) return;
    if (safeRedirect) {
      window.location.replace(safeRedirect);
      return;
    }
    navigate({ to: "/", replace: true });
  }, [authLoading, navigate, safeRedirect, session]);

  if (authLoading || session) {
    return <LoadingScreen />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    if (safeRedirect) {
      window.location.href = safeRedirect;
      return;
    }
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <Wordmark size="xl" />
          <p className="text-sm text-muted-foreground mt-3">Welcome back — sign in to continue your practice.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6">
          <div>
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Password</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          New here?{" "}
          <Link to="/signup" className="text-primary font-medium hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
