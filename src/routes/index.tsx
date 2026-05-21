import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { LoadingScreen } from "@/components/Wordmark";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { loading, session, role } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" />;
  return <Navigate to={role === "admin" ? "/dashboard" : "/program"} />;
}
