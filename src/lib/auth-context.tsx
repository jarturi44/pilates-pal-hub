import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_TIMEOUT_MS = 6500;

function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`${label} timed out`)), AUTH_TIMEOUT_MS);
    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialSession() {
      try {
        const { data: { session: sess } } = await withTimeout(supabase.auth.getSession(), "Auth session restore");
        if (cancelled) return;
        setSession(sess);
        setRole(sess?.user ? await fetchRole(sess.user.id) : null);
      } catch (error) {
        console.warn("Auth session restore failed", error);
        if (!cancelled) {
          setSession(null);
          setRole(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (cancelled) return;
      setSession(sess);
      if (sess?.user) {
        // Defer role fetch to avoid deadlocking the auth callback
        setRole(null);
        setTimeout(() => {
          fetchRole(sess.user.id).then((nextRole) => {
            if (!cancelled) setRole(nextRole);
          });
        }, 0);
      } else {
        setRole(null);
      }
    });

    void loadInitialSession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchRole(userId: string): Promise<AppRole> {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .order("role", { ascending: true }) // 'admin' < 'client' alphabetically
          .limit(1)
          .maybeSingle(),
        "Role lookup",
      );
      if (error) console.warn("Role lookup failed", error);
      return data?.role === "admin" ? "admin" : "client";
    } catch (error) {
      console.warn("Role lookup failed", error);
      return "client";
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
